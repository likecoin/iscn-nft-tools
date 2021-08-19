const fs = require('fs');
const neatCsv = require('neat-csv');
const csvStringify = require('csv-stringify/lib/sync');
const BigNumber = require('bignumber.js');
const {
  getWallet,
  signISCNTx,
  estimateISCNTxGas,
  estimateISCNTxFee,
} = require('./util/iscn');
const { getAccountBalance } = require('./util/iscnQuery');

function convertFieldNames(data) {
  /* eslint-disable camelcase */
  const {
    name,
    description,
    datePublished,
    url,
    author,
    usageInfo,
    keywords,
    articleBody,
    backstory,
    wordCount,
    about,
    abstract,
    accessMode,
    acquireLicensePage,
    copyrightHolder,
    copyrightNotice,
    copyrightYear,
    creativeWorkStatus,
    creator,
    encodingFormat,
    headline,
    license,
    locationCreated,
    text,
    ipfsHash,
    arweaveId,
  } = data;
  /* eslint-enable camelcase */
  const hashes = [];
  if (ipfsHash) hashes.push(`ipfs://${ipfsHash}`);
  if (arweaveId) hashes.push(`ar://${arweaveId}`);
  return {
    type: 'Article',
    name,
    hashes,
    description,
    datePublished,
    url,
    author,
    usageInfo,
    keywords,
    articleBody,
    backstory,
    wordCount,
    about,
    abstract,
    accessMode,
    acquireLicensePage,
    copyrightHolder,
    copyrightNotice,
    copyrightYear,
    creativeWorkStatus,
    creator,
    encodingFormat,
    headline,
    license,
    locationCreated,
    text,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readCsv(path = 'list.csv') {
  const csv = fs.readFileSync(path);
  const data = await neatCsv(csv);
  return data;
}

function writeCsv(data, path = 'output.csv') {
  const d = csvStringify(data);
  fs.writeFileSync(path, d, 'utf8');
}

async function estimateISCNFee(data) {
  const gasFee = estimateISCNTxGas().amount[0].amount;
  let result = new BigNumber(gasFee);
  for (let i = 0; i < data.length; i += 1) {
    /* eslint-disable no-await-in-loop */
    try {
      const payload = convertFieldNames(data[i]);
      const res = await estimateISCNTxFee(payload);
      result = result.plus(res);
    } catch (err) {
      console.error(err);
    }
    /* eslint-enable no-await-in-loop */
  }
  return result.shiftedBy(-9).toFixed();
}

async function handleISCNTx(data) {
  const dataFields = Object.keys(data[0]);
  const result = [[...dataFields, 'txHash', 'iscnId']];
  for (let i = 0; i < data.length; i += 1) {
    /* eslint-disable no-await-in-loop */
    try {
      const values = dataFields.map((field) => data[i][field]);
      const payload = convertFieldNames(data[i]);
      const res = await signISCNTx(payload);
      const { txHash, iscnId } = res;
      const { name } = payload;
      console.log(`${name} ${txHash} ${iscnId}`);
      result.push(values.concat([txHash, iscnId]));
    } catch (err) {
      console.error(err);
    }
    await sleep(20);
    /* eslint-enable no-await-in-loop */
  }
  return result;
}

async function run() {
  const args = process.argv.slice(2);
  const data = await readCsv(args[0]);
  console.log(`size: ${data.length}`);
  const iscnFee = await estimateISCNFee(data);
  console.log(`Fee: ${iscnFee} LIKE`);
  const { account } = await getWallet();
  const balance = new BigNumber(await getAccountBalance(account.address));
  if (balance.lt(iscnFee)) {
    console.error(`low account balance: ${balance.toFixed()}`);
    return;
  }
  const result = await handleISCNTx(data);
  writeCsv(result);
}

run();
