/* eslint-disable no-console */
import { readFileSync } from 'fs';
import path from 'path';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ISCNSigningClient } from '@likecoin/iscn-js';
import yargsParser from 'yargs-parser';
import {
  MNEMONIC, RPC_ENDPOINT,
  // eslint-disable-next-line import/extensions
} from './config/config.js';

async function createNFTSigningClient() {
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
  const [account] = await signer.getAccounts();
  const client = new ISCNSigningClient();
  await client.connectWithSigner(RPC_ENDPOINT, signer);
  return { client, account };
}

async function createISCNFromJSON(signingClient, account) {
  const content = readFileSync(path.join(__dirname, './data/iscn.json'));
  const data = JSON.parse(content);
  console.log(`Creating ISCN - ${data.name}`);
  const res = await signingClient.createISCNRecord(account.address, data);
  console.log(`Creating ISCN - Completed ${res.transactionHash}`);
  const queryClient = await signingClient.getISCNQueryClient();
  const [iscnId] = await queryClient.queryISCNIdsByTx(res.transactionHash);
  console.log(`Creating ISCN - ISCN ID: ${iscnId}`);
  return iscnId;
}

async function createNFTClassFromJSON(iscnID, signingClient, account, { nftMaxSupply } = {}) {
  const content = readFileSync(path.join(__dirname, './data/nft.json'));
  const data = JSON.parse(content);
  console.log(`Creating NFT Class - ${data.name}`);
  let classConfig = null;
  if (nftMaxSupply) classConfig = { nftMaxSupply };
  const res = await signingClient.createNFTClass(account.address, iscnID, data, classConfig);
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

async function mintNFTsFromJSON(classId, nftCount, signingClient, account) {
  const content = readFileSync(path.join(__dirname, './data/nft.json'));
  const data = JSON.parse(content);
  console.log(`Minting ${nftCount} NFTs`);
  const res = await signingClient.mintNFTs(
    account.address,
    classId,
    [...Array(nftCount).keys()].map((i) => ({
      id: `${i}`,
      uri: data.uri,
      metadata: {
        name: data.name,
        image: data.image,
      },
    })),
  );
  console.log(`Minting NFTs - Completed ${res.transactionHash}`);
}

function printHelp() {
  console.log(`Usage: node index.js --nft-count 100
Required Paramters:
  --nft-count: How many NFT to mint
Optional Parameters:
  --iscn-id: Use existing ISCN ID. If ISCN ID is not set, data in ./data/iscn.json will be used.
  --class-id: Use existing NFT class ID.  If NFT class ID is not set, data in ./data/nft.json will be used.
  --nft-max-supply: Define max supply for new NFT class
  `)
}

async function run() {
  const args = yargsParser(process.argv.slice(2));
  const {
    nftCount,
    nftMaxSupply,
    iscnId,
    classId,
    help,
  } = args
  if (help) {
    printHelp();
    return;
  }
  if (!nftCount || !Number(nftCount)) {
    console.error('Invalid NFT count');
    return;
  }
  if (nftMaxSupply && !Number(nftMaxSupply)) {
    console.error('Invalid NFT max supply');
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
    } else {
      console.log(`Using existing NFT Class ID ${classId}`);
    }
    await mintNFTsFromJSON(classId, Number(nftCount), signingClient, account);
  } catch (error) {
    console.error(error);
  }
}

run();
