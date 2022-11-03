import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { TimeoutError } from '@cosmjs/stargate';
import { ISCNQueryClient, ISCNSigningClient } from '@likecoin/iscn-js';
import fs from 'fs';
import neatCsv from 'neat-csv';
import BigNumber from 'bignumber.js';
/* eslint-disable import/extensions */
import { formatMsgSend } from '@likecoin/iscn-js/dist/messages/likenft.js';
import { PageRequest } from 'cosmjs-types/cosmos/base/query/v1beta1/pagination.js';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
/* eslint-enable import/extensions */
import {
  MNEMONIC, WAIT_TIME, RPC_ENDPOINT, DENOM, MEMO,
  // eslint-disable-next-line import/extensions
} from './config/config.js';

const gasNeedDigits = 5;
const amountNeedDigits = 6;

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

async function getNFTs({ classId = '', owner = '', needCount }) {
  const needPages = Math.ceil(needCount / 100);
  const c = await getNFTQueryClient();
  const client = await c.getQueryClient();
  const nfts = [];
  let next = new Uint8Array([0x00]);
  let pageCounts = 0;
  do {
    /* eslint-disable no-await-in-loop */
    const res = await client.nft.NFTs(
      classId,
      owner,
      PageRequest.fromPartial({ key: next }),
    );
    ({ nextKey: next } = res.pagination);
    nfts.push(...res.nfts);
    if (pageCounts > needPages) break;
    pageCounts += 1;
  } while (next && next.length);
  return { nfts };
}

function getGasFee(count) {
  return {
    amount: [
      {
        denom: DENOM,
        amount: `${new BigNumber(count).shiftedBy(amountNeedDigits).toFixed(0)}`,
      },
    ],
    gas: `${new BigNumber(count).shiftedBy(gasNeedDigits).toFixed(0)}`,
  };
}

async function run() {
  try {
    const data = await readCsv('list.csv');
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
    const [firstAccount] = await signer.getAccounts();

    const nftsDataObject = {};
    const nftCountObject = data.reduce((object, item) => {
      // eslint-disable-next-line no-param-reassign
      object[item.classId] = (object[item.classId] || 0) + 1;
      return object;
    }, {});

    let hasError = false;
    for (let i = 0; i < Object.keys(nftCountObject).length; i += 1) {
      const classId = Object.keys(nftCountObject)[i];
      const needCount = nftCountObject[classId];
      const { nfts } = await getNFTs({
        classId,
        owner: firstAccount.address,
        needCount,
      });
      nftsDataObject[classId] = nfts;
      if (needCount > nftsDataObject[classId].length) {
        hasError = true;
        // eslint-disable-next-line no-console
        console.log(`NFT classId: ${classId} (own quantity: ${nftsDataObject[classId].length}), Will send ${needCount} counts, NFT not enough!`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`NFT classId: ${classId}, Will send ${needCount} counts, data ok!`);
      }
    }

    if (hasError) {
      throw new Error('need check list');
    }

    // eslint-disable-next-line no-console
    console.log('Terminate if not expected (control+c)');
    await sleep(WAIT_TIME);

    const signingClient = await createNFTSigningClient(signer);
    const client = signingClient.getSigningStargateClient();

    const hasCsvMemo = data.some((e) => e.memo);

    const { accountNumber, sequence } = await client.getSequence(firstAccount.address);
    const chainId = await client.getChainId();

    const msgAnyArray = [];
    let currentSequence = sequence;
    for (let i = 0; i < data.length; i += 1) {
      const e = data[i];
      const removed = nftsDataObject[e.classId].splice(0, 1);
      if (hasCsvMemo) {
        const tx = await client.sign(
          firstAccount.address,
          [formatMsgSend(
            firstAccount.address,
            e.address,
            e.classId,
            removed[0].id,
          )],
          getGasFee(1),
          e.memo || MEMO,
          {
            accountNumber,
            sequence: currentSequence,
            chainId,
          },
        );
        currentSequence += 1;
        try {
          const txBytes = TxRaw.encode(tx).finish();
          const res = await client.broadcastTx(txBytes, 1000, 1000);
          console.log(res);
        } catch (err) {
          if (err instanceof TimeoutError) {
            console.log(err.txId);
          } else {
            throw err;
          }
        }
      } else {
        const msgAny = formatMsgSend(
          firstAccount.address,
          e.address,
          e.classId,
          removed[0].id,
        );
        msgAnyArray.push(msgAny);
      }
    }

    if (msgAnyArray.length) {
      const result = await client.signAndBroadcast(
        firstAccount.address,
        msgAnyArray,
        getGasFee(data.length),
        MEMO,
      );
      // eslint-disable-next-line no-console
      console.log(result);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
run();
