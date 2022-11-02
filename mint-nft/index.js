/* eslint-disable no-console */
import { readFileSync } from 'fs';
import path from 'path';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ISCNSigningClient } from '@likecoin/iscn-js';
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

async function createNFTClassFromJSON(iscnID, signingClient, account) {
  const content = readFileSync(path.join(__dirname, './data/nft.json'));
  const data = JSON.parse(content);
  console.log(`Creating NFT Class - ${data.name}`);
  const res = await signingClient.createNFTClass(account.address, iscnID, data);
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

async function run() {
  const args = process.argv.slice(2);
  const nftCount = args[0] || 100;
  let iscnId = args[1] || '';
  let classId;
  try {
    const { account, client: signingClient } = await createNFTSigningClient();
    console.log(`Using ${account.address} to mint NFT`);
    if (!iscnId) iscnId = await createISCNFromJSON(signingClient, account);
    if (!classId) classId = await createNFTClassFromJSON(iscnId, signingClient, account);
    await mintNFTsFromJSON(classId, nftCount, signingClient, account);
  } catch (error) {
    console.error(error);
  }
}

run();
