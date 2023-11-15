/* eslint-disable import/no-extraneous-dependencies */
import axios from 'axios';
import { Secp256k1HdWallet } from '@cosmjs/amino';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ISCNQueryClient, ISCNSigningClient } from '@likecoin/iscn-js';
import jsonStringify from 'fast-json-stable-stringify'

import {
  LIKE_CO_API,
  LIKECOIN_CHAIN_RPC_URL,
  CHAIN_ID,
  DENOM,
  MNEMONIC,
} from './config.js';

let signingWallet;
let signingAddress;
let iscnQueryClient;
let iscnSigningClient;
let signingStargateClient;

async function getWallet() {
  if (!signingWallet) {
    signingWallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
  }
  return signingWallet;
}

export async function getAddress() {
  if (!signingAddress) {
    const wallet = await getWallet();
    const [{ address }] = await wallet.getAccounts();
    signingAddress = address;
    // eslint-disable-next-line no-console
    console.log(address);
  }
  return signingAddress;
}

export async function getISCNQueryClient() {
  if (!iscnQueryClient) {
    const pendingClient = new ISCNQueryClient();
    await pendingClient.connect(LIKECOIN_CHAIN_RPC_URL);
    iscnQueryClient = pendingClient;
  }
  return iscnQueryClient;
}

export async function getISCNSigningClient() {
  if (!iscnSigningClient) {
    const wallet = await getWallet();
    const pendingClient = new ISCNSigningClient(LIKECOIN_CHAIN_RPC_URL);
    await pendingClient.connectWithSigner(LIKECOIN_CHAIN_RPC_URL, wallet);
    iscnSigningClient = pendingClient;
  }
  return iscnSigningClient;
}

async function getSigningStargateClient() {
  if (!signingStargateClient) {
    iscnSigningClient = await getISCNSigningClient();
    signingStargateClient = iscnSigningClient.getSigningStargateClient();
  }
  return signingStargateClient;
}

export async function getSignerData() {
  const [address, client] = await Promise.all([getAddress(), getSigningStargateClient()]);
  const { accountNumber, sequence } = await client.getSequence(address);
  const chainId = await client.getChainId();
  return { accountNumber, sequence, chainId };
}

export async function getSequence() {
  const [address, client] = await Promise.all([getAddress(), getSigningStargateClient()]);
  const { sequence } = await client.getSequence(address);
  return sequence;
}

export function validateISCNPrefix(input) {
  const res = /^(iscn:\/\/likecoin-chain\/[A-Za-z0-9-_]+)(?:\/([0-9]*))?$/.exec(input);
  if (!res) throw new Error(`Invalid ISCN prefix ${input}, please check the input`);
}

export async function getToken() {
  try {
    const aminoSigner = await Secp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
    const [firstAccount] = await aminoSigner.getAccounts();
    const { address } = firstAccount;
    const ts = Date.now()
    const payload = JSON.stringify({
      action: 'authorize',
      permissions: ['read:nftbook', 'write:nftbook'],
      likeWallet: address,
      ts
    });
    const signingPayload = {
      chain_id: CHAIN_ID,
      memo: payload,
      msgs: [],
      fee: {
        gas: '0',
        amount: [
          {
            denom: DENOM,
            amount: '0'
          }
        ]
      },
      sequence: '0',
      account_number: '0'
    }
    const { signed, signature } = await aminoSigner.signAmino(address, signingPayload)
    const authorizingPayload = {
      wallet: address,
      signature: signature.signature,
      publicKey: signature.pub_key.value,
      message: jsonStringify(signed),
      signMethod: 'memo'
    }
    const { data } = await axios.post(`${LIKE_CO_API}/wallet/authorize`, authorizingPayload);
    return data.token;
  } catch (error) {
    console.error('Cannot get token');
    throw error;
  }
}
