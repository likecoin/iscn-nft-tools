const fs = require('fs');
const neatCsv = require('neat-csv');
const csvStringify = require('csv-stringify/lib/sync');
const BigNumber = require('bignumber.js');
const { ISCNQueryClient, ISCNSigningClient } = require('@likecoin/iscn-js');
const {
  getWallet,
  getSequence,
  getSignerData,
  getAccountBalance,
} = require('./util/iscn');
const { ISCN_RPC_URL } = require('./config/config');

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
  const info = usageInfo || license;
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

async function readCsv(path) {
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

async function estimateISCNFee(signingClient, data) {
  const gasFee = (await signingClient.estimateISCNTxGas(data)).fee.amount[0].amount;
  let result = new BigNumber(gasFee);
  const promises = [];
  try {
    data.forEach((item) => {
      const payload = convertFieldNames(item);
      promises.push(signingClient.estimateISCNTxFee(payload));
    });
    const coins = await Promise.all(promises);
    result = coins.reduce((sum, curr) => sum.plus(curr.amount), result);
  } catch (err) {
    console.error(err);
  }
  return result.shiftedBy(-9).toFixed();
}

async function run() {
  const args = process.argv.slice(2);
  const filename = args[0] || 'list.csv';
  const data = await readCsv(filename);
  const isUpdate = args.includes('--update');
  console.log(`size: ${data.length}`);
  const { wallet, account: { address } } = await getWallet();
  const queryClient = new ISCNQueryClient();
  const signingClient = new ISCNSigningClient(ISCN_RPC_URL);
  await Promise.all([
    queryClient.connect(ISCN_RPC_URL),
    signingClient.connectWithSigner(ISCN_RPC_URL, wallet),
  ]);
  const iscnFee = await estimateISCNFee(signingClient, data);
  console.log(`Fee: ${iscnFee} LIKE`);
  const balance = new BigNumber(await getAccountBalance(queryClient, address));
  if (balance.lt(iscnFee)) {
    console.error(`low account balance: ${balance.toFixed()}`);
    return;
  }
  const outputFilename = `output-${filename}`;
  const dataFields = Object.keys(data[0]);
  if (!dataFields.includes('txHash')) {
    dataFields.push('txHash');
  }
  if (!dataFields.includes('iscnId')) {
    dataFields.push('iscnId');
  }
  const result = [dataFields];
  if (!checkIfCsvExists()) writeCsv(result, outputFilename);
  const signerData = await getSignerData();
  const { accountNumber, chainId } = signerData;
  let { sequence } = signerData;
  for (let i = 0; i < data.length; i += 1) {
    const payload = convertFieldNames(data[i]);
    let { iscnId, txHash } = payload;
    const { name } = payload;
    /* eslint-disable no-await-in-loop */
    try {
      const shouldSign = !iscnId || isUpdate;
      if (shouldSign) {
        try {
          const res = await signingClient.createISCNRecord(address, payload,
            { accountNumber, sequence, chainId });
          ({ transactionHash: txHash } = res);
          [iscnId] = await queryClient.queryISCNIdsByTx(txHash);
        } catch (err) {
          console.error(err);
          console.error(`Retrying ${name} in 15s`);
          await sleep(15000);
          const { message } = err;
          if (message && message.includes('code 32')) {
            console.log(`Nonce ${signerData.sequence} failed, trying to refetch sequence`);
            sequence = await getSequence();
          }
          const res = await signingClient.createISCNRecord(address, payload,
            { accountNumber, sequence, chainId });
          ({ transactionHash: txHash } = res);
          [iscnId] = await queryClient.queryISCNIdsByTx(txHash);
        }
        sequence += 1;
      }
      console.log(`${name} ${txHash} ${iscnId}`);
    } catch (err) {
      console.error(err);
    } finally {
      const newData = { ...data };
      newData[i].txHash = txHash;
      newData[i].iscnId = iscnId;
      const entry = dataFields.map((field) => newData[i][field]);
      writeCsv([entry], outputFilename);
      result.push(entry);
    }
  }
}
run();
