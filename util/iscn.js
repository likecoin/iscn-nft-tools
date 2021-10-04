// eslint-disable-next-line import/no-extraneous-dependencies
const { Registry, DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { MsgCreateIscnRecord, MsgUpdateIscnRecord } = require('@likecoin/iscn-message-types/dist/iscn/tx');
const {
  defaultRegistryTypes,
  SigningStargateClient,
} = require('@cosmjs/stargate');

const { ISCN_RPC_URL, COSMOS_MNEMONIC } = require('../config/config');

const registry = new Registry([
  ...defaultRegistryTypes,
  ['/likechain.iscn.MsgCreateIscnRecord', MsgCreateIscnRecord],
  ['/likechain.iscn.MsgUpdateIscnRecord', MsgUpdateIscnRecord],
]);

let signingWallet;
let signingAccounts;
let signingClient;

async function getWallet() {
  if (!signingWallet) {
    signingWallet = await DirectSecp256k1HdWallet.fromMnemonic(COSMOS_MNEMONIC);
    [signingAccounts] = await signingWallet.getAccounts();
    console.log(signingAccounts.address);
  }
  return { wallet: signingWallet, account: signingAccounts };
}

async function getSigningClient(wallet) {
  if (!signingClient) {
    signingClient = await SigningStargateClient.connectWithSigner(
      ISCN_RPC_URL,
      wallet,
      { registry },
    );
  }
  return signingClient;
}

async function getSequence() {
  const { wallet, account: { address } } = await getWallet();
  const client = await getSigningClient(wallet);
  const { sequence } = await client.getSequence(address);
  return sequence;
}

async function getSignerData() {
  const { wallet, account: { address } } = await getWallet();
  const client = await getSigningClient(wallet);
  const { accountNumber, sequence } = await client.getSequence(address);
  const chainId = await client.getChainId();
  return { accountNumber, sequence, chainId };
}

module.exports = {
  getWallet,
  getSequence,
  getSignerData,
};
