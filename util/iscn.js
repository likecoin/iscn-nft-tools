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
    signingWallet = await DirectSecp256k1HdWallet.fromMnemonic(COSMOS_MNEMONIC);
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
      const gasFeePromises = [];
      const ISCNFeePromises = [];
      for (let i = chunkStart; i < chunkStart + chunkSize && i < data.length; i += 1) {
        gasFeePromises.push(signingClient.estimateISCNTxGas(data[i], { gasPrice }));
        ISCNFeePromises.push(signingClient.estimateISCNTxFee(data[i]));
      }
      /* eslint-disable no-await-in-loop */
      const gasFees = await Promise.all(gasFeePromises);
      const ISCNFees = await Promise.all(ISCNFeePromises);
      /* eslint-enable no-await-in-loop */
      totalGasFee = gasFees.reduce(
        (sum, curr) => sum.plus(curr.fee.amount[0].amount), totalGasFee,
      );
      totalISCNFee = ISCNFees.reduce((sum, curr) => sum.plus(curr.amount), totalISCNFee);
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
