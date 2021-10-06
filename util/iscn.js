/* eslint-disable import/no-extraneous-dependencies */
const BigNumber = require('bignumber.js');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { ISCNQueryClient, ISCNSigningClient } = require('@likecoin/iscn-js');

const { ISCN_RPC_URL, COSMOS_MNEMONIC } = require('../config/config');

const COSMOS_DENOM = 'nanolike';

let signingWallet;
let signingAddress;
let iscnQueryClient;
let iscnSigningClient;
let signingStargateClient;

async function getWallet() {
  if (!signingWallet) {
    signingWallet = await DirectSecp256k1HdWallet.fromMnemonic(COSMOS_MNEMONIC);
  }
  return signingWallet;
}

async function getAddress() {
  if (!signingAddress) {
    const wallet = await getWallet();
    const [{ address }] = await wallet.getAccounts();
    signingAddress = address;
    console.log(address);
  }
  return signingAddress;
}

async function getISCNQueryClient() {
  if (!iscnQueryClient) {
    iscnQueryClient = new ISCNQueryClient();
    await iscnQueryClient.connect(ISCN_RPC_URL);
  }
  return iscnQueryClient;
}

async function getISCNSigningClient() {
  if (!iscnSigningClient) {
    const wallet = await getWallet();
    iscnSigningClient = new ISCNSigningClient(ISCN_RPC_URL);
    await iscnSigningClient.connectWithSigner(ISCN_RPC_URL, wallet);
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

async function getSignerData() {
  const [address, client] = await Promise.all([getAddress(), getSigningStargateClient()]);
  const { accountNumber, sequence } = await client.getSequence(address);
  const chainId = await client.getChainId();
  return { accountNumber, sequence, chainId };
}

async function getSequence() {
  const [address, client] = await Promise.all([getAddress(), getSigningStargateClient()]);
  const { sequence } = await client.getSequence(address);
  return sequence;
}

async function getAccountBalance() {
  const [address, client] = await Promise.all([getAddress(), getSigningStargateClient()]);
  const balance = await client.getBalance(address, COSMOS_DENOM);
  return balance;
}

async function createISCNRecord(payload, signOptions) {
  const [address, queryClient, signingClient] = await Promise.all([
    getAddress(), getISCNQueryClient(), getISCNSigningClient()]);
  const res = await signingClient.createISCNRecord(address, payload, signOptions);
  const { transactionHash: txHash } = res;
  const [iscnId] = await queryClient.queryISCNIdsByTx(txHash);
  return { txHash, iscnId };
}

async function estimateISCNFee(data) {
  const signingClient = await getISCNSigningClient();
  const gasFee = (await signingClient.estimateISCNTxGas(data)).fee.amount[0].amount;
  let result = new BigNumber(gasFee);
  try {
    const promises = data.map((item) => signingClient.estimateISCNTxFee(item));
    const coins = await Promise.all(promises);
    result = coins.reduce((sum, curr) => sum.plus(curr.amount), result);
  } catch (err) {
    console.error(err);
  }
  return result.shiftedBy(-9).toFixed();
}

module.exports = {
  getWallet,
  getAddress,
  getISCNQueryClient,
  getISCNSigningClient,
  getSigningStargateClient,
  getSequence,
  getSignerData,
  getAccountBalance,
  createISCNRecord,
  estimateISCNFee,
};
