/* eslint-disable no-console */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ISCNSigningClient } from '@likecoin/iscn-js';
// eslint-disable-next-line import/extensions
import { parseAndCalculateStakeholderRewards } from '@likecoin/iscn-js/dist/iscn/parsing.js';
import yargsParser from 'yargs-parser';
import { v4 as uuidv4 } from 'uuid';
import neatCsv from 'neat-csv';
// eslint-disable-next-line import/no-unresolved
import { stringify } from 'csv-stringify/sync';
import {
  MNEMONIC, RPC_ENDPOINT,
  // eslint-disable-next-line import/extensions
} from './config/config.js';

/* eslint-disable no-underscore-dangle */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/* eslint-enable no-underscore-dangle */

const LIKER_NFT_FEE_WALLET = 'like10ywsmztkxjl55xarxnhlxwc83z9v2hkxtsajwl';
const royaltyRateBasisPoints = 1000; // 10% as in current chain config
const royaltyFeeAmount = 25000; // 2.5%
const royaltyUserAmount = 1000000 - royaltyFeeAmount; // 1000000 - fee

function addParamToUrl(url, params) {
  const urlObject = new URL(url);
  const urlParams = new URLSearchParams(urlObject.search);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      urlParams.set(key, value);
    }
  });
  urlObject.search = urlParams.toString();
  return urlObject.toString();
}

async function readCsv(csvPath) {
  const csv = readFileSync(csvPath);
  const data = await neatCsv(csv);
  return data;
}

async function createNFTSigningClient() {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
  const [account] = await signer.getAccounts();
  const client = new ISCNSigningClient();
  await client.connectWithSigner(RPC_ENDPOINT, signer);
  return { client, account };
}

async function createISCNFromJSON(signingClient, account) {
  console.log('Creating ISCN - Reading data from ./data/iscn.json...');
  const content = readFileSync(path.join(__dirname, './data/iscn.json'));
  const data = JSON.parse(content);
  if (!data || !data.contentMetadata) throw new Error('Invalid ISCN data json');
  console.log(`Creating ISCN - ${data.contentMetadata.name}`);
  const { contentMetadata, ...otherData } = data;
  const parsedData = { ...otherData, ...contentMetadata };
  const res = await signingClient.createISCNRecord(account.address, parsedData);
  console.log(`Creating ISCN - Completed ${res.transactionHash}`);
  const queryClient = await signingClient.getISCNQueryClient();
  const [iscnId] = await queryClient.queryISCNIdsByTx(res.transactionHash);
  console.log(`Creating ISCN - ISCN ID: ${iscnId}`);
  return iscnId;
}

async function createNFTClassFromJSON(iscnId, signingClient, account, { nftMaxSupply } = {}) {
  console.log('Creating NFT Class - Reading data from ./data/nft_class.json...');
  const content = readFileSync(path.join(__dirname, './data/nft_class.json'));
  const data = JSON.parse(content);
  if (!data || !data.name) throw new Error('Invalid NFT data json');
  console.log(`Creating NFT Class - ${data.name}`);

  let classConfig = null;
  if (nftMaxSupply) classConfig = { nftMaxSupply };

  let { uri } = data;
  const isUriHttp = uri && uri.startsWith('https://');
  if (isUriHttp) uri = addParamToUrl(uri, { iscn_id: iscnId });
  const res = await signingClient.createNFTClass(
    account.address,
    iscnId,
    {
      ...data,
      uri,
    },
    classConfig,
  );
  console.log(`Creating NFT Class - Completed ${res.transactionHash}`);
  const rawLogs = JSON.parse(res.rawLog);
  const event = rawLogs[0].events.find(
    (e) => e.type === 'likechain.likenft.v1.EventNewClass',
  );
  const attribute = event.attributes.find((a) => a.key === 'class_id');
  const classId = ((attribute && attribute.value) || '').replace(/^"(.*)"$/, '$1');
  console.log(`Creating NFT Class - NFT Class ID: ${classId}`);
  return classId;
}

async function createRoyaltyConfig(classId, iscnId, signingClient, account) {
  try {
    const rateBasisPoints = royaltyRateBasisPoints;
    const feeAmount = royaltyFeeAmount;
    const totalAmount = royaltyUserAmount;
    const queryClient = await signingClient.getISCNQueryClient();
    const res = await queryClient.queryRecordsById(iscnId);
    if (!res) throw new Error('ISCN NOT FOUND');
    const { owner: iscnOwner, records: [record] } = res;
    const rewardMap = await parseAndCalculateStakeholderRewards(
      record,
      iscnOwner,
      {
        precision: 0,
        totalAmount,
      },
    );
    const rewards = Array.from(rewardMap.entries());
    const stakeholders = rewards.map((r) => {
      const [
        address,
        { amount },
      ] = r;
      return {
        account: address,
        weight: parseInt(amount, 10),
      };
    });
    stakeholders.push({
      account: LIKER_NFT_FEE_WALLET,
      weight: feeAmount,
    });
    await signingClient.createRoyaltyConfig(
      account.address,
      classId,
      {
        rateBasisPoints,
        stakeholders,
      },
    );
  } catch (err) {
    // Don't throw on royalty create, not critical for now
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

async function mintNFTsFromJSON(classId, nftCount, signingClient, account) {
  console.log('Minting NFTs - Reading default data from ./data/nfts_default.json...');
  const content = readFileSync(path.join(__dirname, './data/nfts_default.json'));
  const defaultData = JSON.parse(content);
  if (!defaultData || defaultData.uri === undefined) throw new Error('Invalid NFT data json');
  console.log('Minting NFTs - Reading NFT data from ./data/nfts.csv...');
  const listData = await readCsv(path.join(__dirname, './data/nfts.csv'));
  console.log(`Minting ${nftCount} NFTs - ${defaultData.metadata.name}`);
  if (listData.length && listData.length !== nftCount) throw new Error('NFT data length and nft count not match');
  const defaultURI = defaultData.uri;
  const defaultMetadata = defaultData.metadata;
  const nfts = [...Array(nftCount).keys()].map((i) => {
    const {
      nftId,
      uri: dataUri,
      image: dataImage,
      metadata: dataMetadataString,
    } = listData[i];
    const dataMetadata = JSON.parse(dataMetadataString || '{}');
    const data = { ...defaultMetadata, ...dataMetadata };
    if (dataImage) data.image = dataImage;
    const id = nftId || `nft-${uuidv4()}`;
    let uri = dataUri || defaultURI || '';
    const isUriHttp = uri && uri.startsWith('https://');
    if (isUriHttp) uri = addParamToUrl(uri, { class_id: classId, nft_id: id });
    return {
      id,
      uri,
      metadata: data,
    };
  });
  const res = await signingClient.mintNFTs(
    account.address,
    classId,
    nfts,
  );
  console.log(`Minting NFTs - Completed ${res.transactionHash}`);
  const csvData = stringify(nfts, { header: true });
  writeFileSync(path.join(__dirname, './data/nfts_output.csv'), csvData);
}

function printHelp() {
  console.log(`Usage:
  MNEMONIC="...." node index.js --nft-count 100 --create-new-iscn

Required Paramters:
  --nft-count: How many NFT to mint

Optional Parameters:
  --create-new-iscn: Use data in ./data/iscn.json to create new ISCN record. Cannot be used with --iscn-id or --class-id.
  --iscn-id: Use existing ISCN ID. Should be provided if --create-new-iscn is not set.
  --class-id: Use existing NFT class ID. If NFT class ID is not set, data in ./data/nft.json will be used.
  --nft-max-supply: Define max supply for new NFT class.
  `);
}

async function run() {
  if (!MNEMONIC) {
    console.error('MNEMONIC is not defined in env!');
    printHelp();
    return;
  }
  const args = yargsParser(process.argv.slice(2), {
    boolean: [
      'create-new-iscn',
      'help',
    ],
    string: [
      'iscn-id',
      'class-id',
    ],
    number: [
      'nft-count',
      'nft-max-supply',
    ],
  });
  const {
    createNewIscn,
    nftCount,
    nftMaxSupply,
    help,
  } = args;
  let {
    iscnId,
    classId,
  } = args;
  if (help) {
    printHelp();
    return;
  }
  if (!nftCount || !Number(nftCount)) {
    console.error('Invalid NFT count');
    printHelp();
    return;
  }
  if (createNewIscn && (iscnId || classId)) {
    console.error('Cannot create new ISCN and use existing ISCN ID or class ID at the same time');
    printHelp();
    return;
  }
  if (!createNewIscn && !iscnId && !classId) {
    console.error('Either --create-new-iscn, --iscn-id, --class-id must be set');
    printHelp();
    return;
  }
  if (nftMaxSupply && !Number(nftMaxSupply)) {
    console.error('Invalid NFT max supply');
    printHelp();
    return;
  }
  if (classId && nftMaxSupply) {
    console.error('Cannot set max supply for existing class');
    printHelp();
    return;
  }
  if (nftCount >= nftMaxSupply) {
    console.error('NFT count larger than max supply');
    printHelp();
    return;
  }
  try {
    const { account, client: signingClient } = await createNFTSigningClient();
    console.log(`Using ${account.address} to mint NFT`);
    if (!classId) {
      if (!iscnId) {
        iscnId = await createISCNFromJSON(signingClient, account);
      } else {
        console.log(`Using existing ISCN ID ${iscnId}`);
      }
    }
    if (!classId) {
      classId = await createNFTClassFromJSON(iscnId, signingClient, account, { nftMaxSupply });
      await createRoyaltyConfig(classId, iscnId, signingClient, account);
    } else {
      console.log(`Using existing NFT Class ID ${classId}`);
    }
    await mintNFTsFromJSON(classId, Number(nftCount), signingClient, account);
  } catch (error) {
    console.error(error);
  }
}

run();
