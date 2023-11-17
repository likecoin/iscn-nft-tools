import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ISCNQueryClient, ISCNSigningClient } from '@likecoin/iscn-js';
import fs from 'fs';
import neatCsv from 'neat-csv';
import BigNumber from 'bignumber.js';
/* eslint-disable import/extensions */
import { formatMsgCreateListing } from '@likecoin/iscn-js/dist/messages/likenft.js';
/* eslint-enable import/extensions */
import {
  MNEMONIC, WAIT_TIME, RPC_ENDPOINT, DENOM, MEMO,
  // eslint-disable-next-line import/extensions
} from './config/config.js';

const defaultExpirationInMs = Date.now() + 15552000000;
const DEFAULT_GAS_AMOUNT = 200000;
const DEFAULT_GAS_PRICE = 10000;

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function readCsv(path) {
  const csv = fs.readFileSync(path);
  const data = await neatCsv(csv);
  return data;
}

async function createNFTSigningClient(signer) {
  const client = new ISCNSigningClient();
  await client.connectWithSigner(RPC_ENDPOINT, signer);
  return client;
}

async function getNFTQueryClient() {
  const client = new ISCNQueryClient();
  await client.connect(RPC_ENDPOINT);
  return client;
}

async function getNFTOwner(classId, nftId) {
  const c = await getNFTQueryClient();
  const client = await c.getQueryClient();
  const res = await client.nft.owner(
    classId,
    nftId,
  );
  return { owner: res.owner };
}

function getGasFee(count) {
  return {
    amount: [
      {
        denom: DENOM,
        amount: new BigNumber(count)
          .multipliedBy(DEFAULT_GAS_AMOUNT)
          .multipliedBy(DEFAULT_GAS_PRICE)
          .toFixed(0),
      },
    ],
    gas: new BigNumber(count)
      .multipliedBy(DEFAULT_GAS_AMOUNT)
      .toFixed(0),
  };
}

async function run() {
  try {
    const data = await readCsv('list.csv');
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
    const [firstAccount] = await signer.getAccounts();

    let hasError = false;
    for (let i = 0; i < data.length; i += 1) {
      const { classId, nftId, price } = data[i];
      if (!price) {
        hasError = true;
        console.error(`NFT classId: ${classId} nftId:${nftId} price is not defined in csv!`);
      }
      // eslint-disable-next-line no-await-in-loop
      const { owner } = await getNFTOwner(classId, nftId);
      if (owner !== firstAccount.address) {
        hasError = true;
        console.error(`NFT classId: ${classId} nftId:${nftId} is not owned by sender!`);
      }
    }

    if (!hasError) {
      // eslint-disable-next-line no-console
      console.log(`Will list ${data.length} nfts, data ok!`);
    } else {
      throw new Error('need check list');
    }

    console.log(`Using default expiration of ${new Date(defaultExpirationInMs)} if not defined in csv`);

    // eslint-disable-next-line no-console
    console.log('Terminate if not expected (control+c)');
    await sleep(WAIT_TIME);

    const signingClient = await createNFTSigningClient(signer);
    const client = signingClient.getSigningStargateClient();

    const msgAnyArray = [];
    for (let i = 0; i < data.length; i += 1) {
      const e = data[i];

      const msgList = formatMsgCreateListing(
        firstAccount.address,
        e.classId,
        e.nftId,
        new BigNumber(e.price).shiftedBy(9).toFixed(),
        (new Date(e.expiration)).getTime() || defaultExpirationInMs,
      );
      msgAnyArray.push(msgList);
    }

    const result = await client.signAndBroadcast(
      firstAccount.address,
      msgAnyArray,
      getGasFee(data.length),
      MEMO,
    );
    // eslint-disable-next-line no-console
    console.log(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
run();
