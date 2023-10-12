/* eslint-disable import/no-extraneous-dependencies */
const BigNumber = require('bignumber.js');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { ISCNQueryClient, ISCNSigningClient } = require('@likecoin/iscn-js');

const { ISCN_RPC_URL, COSMOS_MNEMONIC, COSMOS_DENOM } = require('../config/config');

let signingWallet;
let signingAddress;
let iscnQueryClient;
let iscnSigningClient;
let signingStargateClient;

async function getWallet() {
  if (!signingWallet) {
    signingWallet = await DirectSecp256k1HdWallet.fromMnemonic(COSMOS_MNEMONIC, { prefix: 'like' });
  }
  return signingWallet;
}

async function getAddress() {
  if (!signingAddress) {
    const wallet = await getWallet();
    const [{ address }] = await wallet.getAccounts();
    signingAddress = address;
    // eslint-disable-next-line no-console
    console.log(address);
  }
  return signingAddress;
}

async function getISCNQueryClient() {
  if (!iscnQueryClient) {
    const pendingClient = new ISCNQueryClient();
    await pendingClient.connect(ISCN_RPC_URL);
    iscnQueryClient = pendingClient;
  }
  return iscnQueryClient;
}

async function getISCNSigningClient() {
  if (!iscnSigningClient) {
    const wallet = await getWallet();
    const pendingClient = new ISCNSigningClient(ISCN_RPC_URL);
    await pendingClient.connectWithSigner(ISCN_RPC_URL, wallet);
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

async function signISCN(payload, signOptions, iscnIdForUpdate) {
  const [address, queryClient, signingClient] = await Promise.all([
    getAddress(), getISCNQueryClient(), getISCNSigningClient()]);
  let res;
  if (iscnIdForUpdate) {
    res = await signingClient.updateISCNRecord(address, iscnIdForUpdate, payload, signOptions);
  } else {
    res = await signingClient.createISCNRecord(address, payload, signOptions);
  }
  const { transactionHash: txHash } = res;
  const [iscnId] = await queryClient.queryISCNIdsByTx(txHash);
  return { txHash, iscnId };
}

async function estimateISCNFee(data, gasPrice) {
  const signingClient = await getISCNSigningClient();
  const chunkSize = 100000;
  let totalGasFee = new BigNumber(0);
  let totalISCNFee = new BigNumber(0);
  try {
    for (let chunkStart = 0; chunkStart < data.length; chunkStart += chunkSize) {
      const promises = data.slice(chunkStart, chunkStart + chunkSize)
        .map((payload) => signingClient.esimateISCNTxGasAndFee(payload, { gasPrice }));
      /* eslint-disable no-await-in-loop */
      const fees = await Promise.all(promises);
      /* eslint-enable no-await-in-loop */
      totalGasFee = fees.reduce(
        (sum, { gas }) => sum.plus(gas.fee.amount[0].amount), totalGasFee,
      );
      totalISCNFee = fees.reduce((sum, { iscnFee }) => sum.plus(iscnFee.amount), totalISCNFee);
    }
    return totalGasFee.plus(totalISCNFee).shiftedBy(-9).toFixed();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to estimate fee');
    throw err;
  }
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
  signISCN,
  estimateISCNFee,
};
