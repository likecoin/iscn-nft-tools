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
  fs.writeFileSync(path, d, {
      encoding: "utf8",
      flag: "a+"
    });
  
}

function convertFieldNames(data) {
  /* eslint-disable camelcase */
  const {
    hash,
    title,
    link,
    author,
    subtitle,
    image_href,
    summary,
    enclosure_length,
    enclosure_type,
    pubDate,
    duration,
    showname,
    iscnId: iscn_id,
  } = data;
  /* eslint-enable camelcase */
  return {
    type: 'Episode',
    hash: `ipfs://${hash}`,
    name: title,
    headline: title,
    url: link,
    author,
    abstract: subtitle,
    thumbnailUrl: image_href,
    descrption: summary,
    size: enclosure_length,
    encodingFormat: enclosure_type,
    datePublished: pubDate,
    duration,
    partOfSeries: showname,
    iscnId: iscn_id,
  };
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
  //const result = [[...dataFields, 'txHash', 'iscnId']];  
  const fieldname = [[...dataFields, 'txHash', 'iscnId']];
  result = [[]];

  writeCsv(fieldname, path = 'output.csv')
  for (let i = 0; i < data.length; i += 1) {
    /* eslint-disable no-await-in-loop */
    try {
      const values = dataFields.map((field) => data[i][field]);
      const payload = convertFieldNames(data[i]);
      const res = await signISCNTx(payload);
      const { txHash, iscnId } = res;
      const { name } = payload;
      console.log(`${name} ${txHash} ${iscnId}`);
      //result.push(values.concat([txHash, iscnId]));
      result[0]= values.concat([txHash, iscnId]);
      writeCsv(result, path = 'output.csv')

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
//  writeCsv(result);
}

run();
