import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import { formatMsgNewClass, formatMsgMintNFT } from '@likecoin/iscn-js/dist/messages/likenft.js';
import { calculateNFTClassIdByISCNId } from '@likecoin/iscn-js/dist/nft/nftId.js';

import {
  getAddress,
  getISCNQueryClient,
  getISCNSigningClient,
  getSequence,
  getExistingClassCount,
  getSignerData,
  getToken,
  validateISCNPrefix,
} from './iscn.js';

import {
  LIKE_CO_API,
  APP_LIKE_CO_URL,
  LIKER_LAND_URL,
  DEFAULT_CSV,
  NFT_PREFIX,
  NFT_META_COLLECTION_ID,
  NFT_META_COLLECTION_NAME,
  NFT_META_COLLECTION_DESCRIPTION,
  CLASS_SYMBOL,
  SUCCESS_URL,
  CANCEL_URL,
  MODERATOR_WALLETS,
  NOTIFICATION_EMAILS,
  CONNECTED_WALLETS,
  GAS_PRICE,
} from './config.js';

function readCSV(csv) {
  const string = fs.readFileSync(csv).toString();
  const records = parse(string, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true,
  });
  return records;
}

function updateCSV(records, csv) {
  const string = stringify(records, { header: true });
  fs.writeFileSync(csv, string);
}

async function findListing(classId) {
  try {
    await axios.get(`${LIKE_CO_API}/likernft/book/store/${classId}`);
    return true;
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) return false;
    throw error;
  }
}

async function createListing(classId, payload, token, retryTime = 2) {
  try {
    const { data } = await axios.post(`${LIKE_CO_API}/likernft/book/store/${classId}/new`, payload, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return data;
  } catch (error) {
    if (!retryTime) {
      console.error(`[Error] Cannot create listing of ${classId}`);
      throw error;
    }
    console.error(`Retry creating listing of ${classId} in 6s`);
    await sleep(6000);
    return createListing(classId, payload, token, retryTime - 1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryClassId(classId, retryTime = 3) {
  try {
    const iscnQueryClient = await getISCNQueryClient();
    await iscnQueryClient.queryNFTClass(classId);
    return true;
  } catch (error) {
    if (!retryTime) return false;
    console.error(`Retry querying ${classId} in 6s`);
    await sleep(6000);
    return queryClassId(classId, retryTime - 1);
  }
}

async function run() {
  if (!NFT_PREFIX) throw new Error('NFT_PREFIX is not set');
  if (!CLASS_SYMBOL) console.warn('CLASS_SYMBOL is not set');
  if (!NFT_META_COLLECTION_ID) console.warn('NFT_META_COLLECTION_ID is not set');
  if (!NFT_META_COLLECTION_NAME) console.warn('NFT_META_COLLECTION_NAME is not set');
  if (!NFT_META_COLLECTION_DESCRIPTION) console.warn('NFT_META_COLLECTION_DESCRIPTION is not set');

  if (!CLASS_SYMBOL || !NFT_META_COLLECTION_ID || !NFT_META_COLLECTION_NAME || !NFT_META_COLLECTION_DESCRIPTION) {
    await sleep(5000);
  }

  const args = process.argv.slice(2);
  const filename = args[0] || DEFAULT_CSV;

  const address = await getAddress();
  const signerData = await getSignerData();
  const { accountNumber, chainId } = signerData;
  let { sequence } = signerData;

  const token = await getToken();

  const records = readCSV(filename);
  for (const record of records) {
    try {
      // skip if already minted or iscnPrefix is not available
      if (record.classId || !record.iscnPrefix) {
        continue;
      }

      const {
        iscnPrefix,
        classTitle: name,
        classDescription,
        imageUrl,
        mintCount,
        listCount,
        editionTitleEn,
        editionTitleZh,
        editionDescriptionEn,
        editionDescriptionZh,
        editionPriceUSD,
      } = record;
      validateISCNPrefix(iscnPrefix)
      const existingClassCount = await getExistingClassCount(iscnPrefix);
      const classId = calculateNFTClassIdByISCNId(iscnPrefix, existingClassCount);

      const nftClassData = {
        name,
        symbol: CLASS_SYMBOL,
        description: classDescription,
        metadata: {
          name,
          image: imageUrl,
          external_url: `${APP_LIKE_CO_URL}/view/${encodeURIComponent(iscnPrefix)}`,
          nft_meta_collection_id: NFT_META_COLLECTION_ID,
          nft_meta_collection_name: NFT_META_COLLECTION_NAME,
          nft_meta_collection_description: NFT_META_COLLECTION_DESCRIPTION,
        }
      };
      const newClassMsg = formatMsgNewClass(address, iscnPrefix, nftClassData);

      const mapNFTData = (i) => ({
        id: `${NFT_PREFIX}-${i.toString().padStart(4, '0')}`,
        metadata: {
          name,
          image: imageUrl,
          external_url: ``,
        },
      });
      const mintNFTMsgs = Array.from({ length: mintCount }, (_, i) => i)
        .map(i => formatMsgMintNFT(address, classId, mapNFTData(i)));
      const messages = [newClassMsg, ...mintNFTMsgs];
      const iscnSigningClient = await getISCNSigningClient();

      async function retrySendMessages() {
        try {
          const res = await iscnSigningClient.sendMessages(address, messages, {
            accountNumber,
            sequence,
            chainId,
            gasPrice: GAS_PRICE,
            memo: '',
          });
          sequence += 1;
          return res;
        } catch (err) {
          console.error(err);
          if (err.message?.includes('code 32')) {
            console.error(`Nonce ${sequence} failed, trying to refetch sequence`);
            console.error(`Retrying ${name} in 15s`);
            await sleep(15000);
            sequence = await getSequence();
            return retrySendMessages();
          }
          return null;
        }
      }

      const res = await retrySendMessages();
      if (!res || res.code !== 0) {
        console.error(`Skip ${name}`);
        continue;
      }

      const foundClassId = await queryClassId(classId, 3);

      if (!foundClassId) {
        console.error(`Class ${classId} not found, skip ${name}`);
        continue;
      }

      const prices = [{
        name: {
          en: editionTitleEn,
          zh: editionTitleZh,
        },
        description: {
          en: editionDescriptionEn,
          zh: editionDescriptionZh,
        },
        stock: listCount,
        priceInDecimal: editionPriceUSD * 100,
      }]

      const newBookListingPayload = { prices };
      if (SUCCESS_URL) newBookListingPayload.successUrl = SUCCESS_URL;
      if (CANCEL_URL) newBookListingPayload.cancelUrl = CANCEL_URL;
      if (MODERATOR_WALLETS.length) newBookListingPayload.moderatorWallets = MODERATOR_WALLETS;
      if (NOTIFICATION_EMAILS.length) newBookListingPayload.notificationEmails = NOTIFICATION_EMAILS;
      if (CONNECTED_WALLETS.length) newBookListingPayload.connectedWallets = CONNECTED_WALLETS;

      await createListing(classId, newBookListingPayload, token);
      console.log(name, `${LIKER_LAND_URL}/nft/class/${classId}`);
      
      record.classId = classId;
      updateCSV(records, filename);
    } catch (error) {
      console.error(error);
    }
  }
}

run();
