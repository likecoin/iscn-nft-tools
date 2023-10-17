const fs = require('fs');
const neatCsv = require('neat-csv');
const csvStringify = require('csv-stringify/lib/sync');
const BigNumber = require('bignumber.js');
const { version } = require('./package.json');

const {
  getSequence,
  getSignerData,
  getAccountBalance,
  signISCN,
  estimateISCNFee,
} = require('./util/iscn');

const DEFAULT_OUTPUT_PATH = 'output.csv';
const DEFAULT_ARRAY_DELIMITER = ',';
const ARRAY_TYPE_FIELDS = ['keywords', 'sameAs'];
const GAS_PRICE = 10;
const ISCN_RECORD_NOTES = `iscn-batch-uploader ${version}`;

function convertFieldNames(data) {
  const {
    name,
    description,
    type = 'CreativeWork', // or https://schema.org/CreativeWork#subtypes
    author,
    usageInfo,
    license,
    ipfsHash,
    arweaveId,
    fileSHA256,
    recordNotes,
    sameAs,
    ...fields // any other field exists in csv will be put into contentMetadata
  } = data;
  const contentFingerprints = [];
  if (fileSHA256) contentFingerprints.push(`hash://sha256/${fileSHA256}`);
  if (ipfsHash) contentFingerprints.push(`ipfs://${ipfsHash}`);
  if (arweaveId) contentFingerprints.push(`ar://${arweaveId}`);
  const stakeholders = [];
  if (author) {
    stakeholders.push({
      entity: {
        id: author,
        name: author,
      },
      rewardProportion: 1,
      contributionType: 'http://schema.org/author',
    });
  }
  const info = usageInfo || license;
  return {
    ...fields,
    type,
    name,
    contentFingerprints,
    stakeholders,
    description,
    author,
    usageInfo: info,
    recordNotes: recordNotes || ISCN_RECORD_NOTES,
    sameAs,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleArrayFields(data) {
  if (!data[0]) { return data; }
  const fieldsToHandle = ARRAY_TYPE_FIELDS.filter((field) => data[0][field] !== undefined);
  return data.map((input) => {
    const output = { ...input };
    fieldsToHandle.forEach((field) => {
      output[field] = input[field].split(DEFAULT_ARRAY_DELIMITER);
    });
    return output;
  });
}

async function readCsv(path) {
  const csv = fs.readFileSync(path);
  const data = await neatCsv(csv);
  return handleArrayFields(data);
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

async function handleISCNTx(data, { isUpdate = false, outputFilename } = {}) {
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
          const res = await signISCN(payload,
            {
              accountNumber,
              sequence,
              chainId,
              gasPrice: GAS_PRICE,
              memo: ISCN_RECORD_NOTES,
            },
            iscnId);
          ({ txHash, iscnId } = res);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err);
          // eslint-disable-next-line no-console
          console.error(`Retrying ${name} in 15s`);
          await sleep(15000);
          const { message } = err;
          if (message && message.includes('code 32')) {
            // eslint-disable-next-line no-console
            console.log(`Nonce ${sequence} failed, trying to refetch sequence`);
            sequence = await getSequence();
          }
          const res = await signISCN(payload,
            {
              accountNumber,
              sequence,
              chainId,
              gasPrice: GAS_PRICE,
              memo: ISCN_RECORD_NOTES,
            },
            iscnId);
          ({ txHash, iscnId } = res);
        }
        sequence += 1;
      }
      // eslint-disable-next-line no-console
      console.log(`${name} ${txHash} ${iscnId}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      const newData = { ...data };
      newData[i].txHash = txHash;
      newData[i].iscnId = iscnId;
      const entry = dataFields.map((field) => newData[i][field]);
      writeCsv([entry], outputFilename);
      result.push(entry);
    }
    /* eslint-enable no-await-in-loop */
  }
}

async function run() {
  const args = process.argv.slice(2);
  const filename = args[0] || 'list.csv';
  const isUpdate = args.includes('--update');
  const data = await readCsv(filename);
  // eslint-disable-next-line no-console
  console.log(`size: ${data.length}`);
  const convertedData = data.map((item) => convertFieldNames(item));
  const iscnFee = await estimateISCNFee(convertedData, GAS_PRICE);
  // eslint-disable-next-line no-console
  console.log(`Fee: ${iscnFee} LIKE`);
  const { amount } = await getAccountBalance();
  const balance = new BigNumber(amount).shiftedBy(-9);
  if (balance.lt(iscnFee)) {
    // eslint-disable-next-line no-console
    console.error(`low account balance: ${balance.toFixed()}`);
    return;
  }
  const outputFilename = `output-${filename}`;
  await handleISCNTx(data, { isUpdate, outputFilename });
}
run();
