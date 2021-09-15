const fs = require('fs');
const neatCsv = require('neat-csv');
const csvStringify = require('csv-stringify/lib/sync');
const BigNumber = require('bignumber.js');
const {
  getWallet,
  getSequence,
  getSignerData,
  signISCNTx,
  estimateISCNTxGas,
  estimateISCNTxFee,
} = require('./util/iscn');
const { getAccountBalance } = require('./util/iscnQuery');

const DEFAULT_OUTPUT_PATH = 'output.csv';

function convertFieldNames(data) {
  /* eslint-disable camelcase */
  const {
    name,
    description,
    type = 'CreativeWork', // or https://schema.org/CreativeWork#subtypes
    author,
    usageInfo,
    license,
    ipfsHash,
    arweaveId,
    ...fields // any other field exists in csv will be put into contentMetadata
  } = data;
  /* eslint-enable camelcase */
  const hashes = [];
  if (ipfsHash) hashes.push(`ipfs://${ipfsHash}`);
  if (arweaveId) hashes.push(`ar://${arweaveId}`);
  let info = usageInfo || license;
  return {
    ...fields,
    type,
    name,
    hashes,
    description,
    author,
    usageInfo: info,
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

function checkIfCsvExists(path = DEFAULT_OUTPUT_PATH) {
  return fs.existsSync(path);
}

function writeCsv(data, path = DEFAULT_OUTPUT_PATH) {
  const d = csvStringify(data);
  fs.writeFileSync(path, d, {
    encoding: 'utf8',
    flag: 'a+',
  });
}

async function estimateISCNFee(data) {
  const gasFee = estimateISCNTxGas(data).amount[0].amount;
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

async function handleISCNTx(data, isUpdate = false) {
  const dataFields = Object.keys(data[0]);
  if (!dataFields.includes('txHash')) {
    dataFields.push('txHash');
  }
  if (!dataFields.includes('iscnId')) {
    dataFields.push('iscnId');
  }
  const result = [dataFields];
  if (!checkIfCsvExists()) writeCsv(result);
  const signerData = await getSignerData();
  const { accountNumber, chainId } = signerData;
  let { sequence } = signerData;
  for (let i = 0; i < data.length; i += 1) {
    /* eslint-disable no-await-in-loop */
    try {
      const payload = convertFieldNames(data[i]);
      let { iscnId, txHash } = payload;
      const { name } = payload;
      const shouldSign = !iscnId || isUpdate;
      if (shouldSign) {
        try {
          const res = await signISCNTx(payload, { accountNumber, sequence, chainId });
          ({ iscnId, txHash } = res);
        } catch (err) {
          console.error(err);
          const { message } = err;
          if (message && message.includes('code 32')) {
            console.log(`Nonce ${signerData.sequence} failed, trying to refetch sequence`);
            sequence = await getSequence();
          }
          console.error(`Retrying ${name} in 15s`);
          await sleep(15000);
          const res = await signISCNTx(payload, { accountNumber, sequence, chainId });
          ({ iscnId, txHash } = res);
        }
      }
      console.log(`${name} ${txHash} ${iscnId}`);
      const newData = { ...data };
      newData[i].txHash = txHash;
      newData[i].iscnId = iscnId;
      const entry = dataFields.map((field) => newData[i][field]);
      writeCsv([entry]);
      result.push(entry);
      sequence += 1;
      if (shouldSign) { await sleep(1000); }
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
  const isUpdate = args.includes('--update');
  console.log(`size: ${data.length}`);
  const iscnFee = await estimateISCNFee(data);
  console.log(`Fee: ${iscnFee} LIKE`);
  const { account } = await getWallet();
  const balance = new BigNumber(await getAccountBalance(account.address));
  if (balance.lt(iscnFee)) {
    console.error(`low account balance: ${balance.toFixed()}`);
    return;
  }
  await handleISCNTx(data, isUpdate);
}

run();
