/* eslint-disable no-restricted-syntax */
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
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
  MNEMONIC, PRIVATE_KEY, WAIT_TIME, RPC_ENDPOINT, DENOM, MEMO,
  // eslint-disable-next-line import/extensions
} from './config/config.js';

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
    if (!MNEMONIC && !PRIVATE_KEY) throw new Error('need MNEMONIC or PRIVATE_KEY');
    if (MNEMONIC && PRIVATE_KEY) console.warn('MNEMONIC and PRIVATE_KEY both exist, using MNEMONIC');
    const signer = MNEMONIC
      ? await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' })
      : await DirectSecp256k1Wallet.fromKey(Buffer.from(PRIVATE_KEY, 'hex'), 'like');
    const [firstAccount] = await signer.getAccounts();

    // 依據不同的發送地址分組
    const groupedByFromAddress = data.reduce((groups, item) => {
      const fromAddress = item.from_address || firstAccount.address;
      if (!groups[fromAddress]) {
        // eslint-disable-next-line no-param-reassign
        groups[fromAddress] = [];
      }
      groups[fromAddress].push(item);
      return groups;
    }, {});

    const nftsDataObject = {};
    let hasError = false;

    // 檢查每個發送地址的 NFT 持有量
    for (const [fromAddress, items] of Object.entries(groupedByFromAddress)) {
      // 計算每個 classId 需要的 NFT 數量
      const addressNftCountObject = items.reduce((object, item) => {
        // eslint-disable-next-line no-param-reassign
        object[item.classId] = (object[item.classId] || 0) + 1;
        return object;
      }, {});

      // 收集每個 classId 指定的 nftId
      const addressNftIdObject = items.reduce((object, item) => {
        if (item.nftId) {
          // eslint-disable-next-line no-param-reassign
          object[item.classId] = object[item.classId] || [];
          object[item.classId].push(item.nftId);
        }
        return object;
      }, {});

      // 檢查每個 classId 的 NFT 持有量
      for (const classId of Object.keys(addressNftCountObject)) {
        const needCount = addressNftCountObject[classId];

        // 獲取該地址持有的 NFT
        if (!nftsDataObject[fromAddress]) {
          nftsDataObject[fromAddress] = {};
        }

        const { nfts } = await getNFTs({
          classId,
          owner: fromAddress,
          needCount,
        });

        nftsDataObject[fromAddress][classId] = nfts;

        if (needCount > nfts.length) {
          hasError = true;
          // eslint-disable-next-line no-console
          console.log(`NFT classId: ${classId} (owner: ${fromAddress}, quantity: ${nfts.length}), Will send ${needCount} counts, NFT not enough!`);
        }

        if (addressNftIdObject[classId]) {
          for (let j = 0; j < addressNftIdObject[classId].length; j += 1) {
            const nftId = addressNftIdObject[classId][j];
            const { owner } = await getNFTOwner(classId, nftId);
            if (owner !== fromAddress) {
              throw new Error(`NFT classId: ${classId} nftId:${nftId} is not owned by ${fromAddress}!`);
            }
          }

          nftsDataObject[fromAddress][classId] = nftsDataObject[fromAddress][classId]
            .filter((nft) => !addressNftIdObject[classId].includes(nft.id));
        }

        if (!hasError) {
          // eslint-disable-next-line no-console
          console.log(`NFT classId: ${classId}, Owner: ${fromAddress}, Will send ${needCount} counts, data ok!`);
        }
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
      const fromAddress = e.from_address || firstAccount.address;
      let targetNftId = e.nftId;

      if (!targetNftId) {
        const removed = nftsDataObject[fromAddress][e.classId].splice(0, 1);
        targetNftId = removed[0].id;
      }

      let msgSend;
      if (fromAddress !== firstAccount.address) {
        // 如果 from_address 不是 firstAccount.address，使用 formatMsgAuthzExecSend
        msgSend = {
          typeUrl: '/cosmos.authz.v1beta1.MsgExec',
          value: {
            grantee: firstAccount.address,
            msgs: [{
              typeUrl: '/cosmos.nft.v1beta1.MsgSend',
              value: formatMsgSend(
                fromAddress,
                e.to_address,
                e.classId,
                targetNftId,
              ),
            }],
          },
        };
      } else {
        // 如果 from_address 是 firstAccount.address 或未設定，使用原本的 formatMsgSend
        msgSend = formatMsgSend(
          fromAddress,
          e.to_address,
          e.classId,
          targetNftId,
        );
      }

      if (hasCsvMemo) {
        const tx = await client.sign(
          firstAccount.address,
          [msgSend],
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
        msgAnyArray.push(msgSend);
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
