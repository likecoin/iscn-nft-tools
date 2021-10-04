// eslint-disable-next-line import/no-extraneous-dependencies
const { ISCNQueryClient } = require('@likecoin/iscn-js');
const BigNumber = require('bignumber.js');

const { ISCN_RPC_URL } = require('../config/config');

const COSMOS_DENOM = 'nanolike';

async function getAccountBalance(address) {
  const client = new ISCNQueryClient();
  await client.connect(ISCN_RPC_URL);
  const myClient = await client.getQueryClient();
  const balance = await myClient.bank.balance(address, COSMOS_DENOM);
  return (new BigNumber(balance.amount)).shiftedBy(-9).toFixed();
}

module.exports = {
  getAccountBalance,
};
