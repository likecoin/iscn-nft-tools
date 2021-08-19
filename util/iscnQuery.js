// eslint-disable-next-line import/no-extraneous-dependencies
const { Tendermint34Client } = require('@cosmjs/tendermint-rpc');
const { QueryClient, setupBankExtension } = require('@cosmjs/stargate');
const BigNumber = require('bignumber.js');

const { setupISCNExtension } = require('./iscnQueryExtension');

const { ISCN_RPC_URL } = require('../config/config');

const COSMOS_DENOM = 'nanolike';

let feePerByte;
let queryClient;

async function initQueryClient() {
  const tendermintClient = await Tendermint34Client.connect(ISCN_RPC_URL);
  queryClient = QueryClient.withExtensions(
    tendermintClient,
    setupBankExtension,
    setupISCNExtension,
  );
  return queryClient;
}

async function getQueryClient() {
  if (!queryClient) await initQueryClient();
  return queryClient;
}

async function getAccountBalance(address) {
  const client = await getQueryClient();
  const balance = await client.bank.balance(address, COSMOS_DENOM);
  return (new BigNumber(balance.amount)).shiftedBy(-9).toFixed();
}

async function queryFeePerByte() {
  if (feePerByte) return feePerByte;
  const client = await getQueryClient();
  const res = await client.iscn.params();
  if (res && res.params && res.params.feePerByte) {
    const {
      amount,
    } = res.params.feePerByte;
    feePerByte = new BigNumber(amount).shiftedBy(-18).toNumber();
    return feePerByte;
  }
  return 0;
}

module.exports = {
  getAccountBalance,
  queryFeePerByte,
};
