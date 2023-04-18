import { OfflineSigner } from "@cosmjs/proto-signing";
import { ISCNSigningClient, ISCNRecordData } from "@likecoin/iscn-js";
import { parseAndCalculateStakeholderRewards } from "@likecoin/iscn-js/dist/iscn/parsing";
import { DeliverTxResponse } from "@cosmjs/stargate";
import { RPC_URL, LIKER_NFT_FEE_WALLET } from "~/constant";

export const royaltyRateBasisPoints = 1000; // 10% as in current chain config
export const royaltyFeeAmount = 25000; // 2.5%
export const royaltyUserAmount = 1000000 - royaltyFeeAmount; // 1000000 - fee

let iscnSigningClientPromise: Promise<ISCNSigningClient> | null = null;
let iscnSigningClient: ISCNSigningClient | null = null;

function addParamToUrl(url: string, params: { [key: string]: string }) {
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

export async function getSigningClient(): Promise<ISCNSigningClient> {
  if (!iscnSigningClient) {
    if (!iscnSigningClientPromise) {
      iscnSigningClientPromise = new Promise(async (resolve) => {
        const c = new ISCNSigningClient();
        await c.connect(RPC_URL);
        iscnSigningClient = c;
        resolve(c);
      });
    }
    return iscnSigningClientPromise;
  } else {
    return iscnSigningClient;
  }
}

export async function queryISCNById(iscnId: string) {
  const c = (await getSigningClient()).getISCNQueryClient();
  const res = await c.queryRecordsById(iscnId);
  if (!res?.records[0].data) return null;
  return {
    owner: res.owner,
    data: res.records[0].data,
  }
}

export async function signCreateISCNRecord(
  data: any,
  signer: OfflineSigner,
  address: string,
  memo?: string
) {
  const signingClient = await getSigningClient();
  await signingClient.connectWithSigner(RPC_URL, signer)
  const { contentMetadata, ...otherData } = data;
  const parsedData = { ...otherData, ...contentMetadata };
  const res = await signingClient.createISCNRecord(address, parsedData, { memo });
  const queryClient = await signingClient.getISCNQueryClient();
  const [iscnId] = await queryClient.queryISCNIdsByTx((res as DeliverTxResponse).transactionHash);
  return iscnId;
}

export async function signCreateNFTClass(
  data: any,
  iscnId: string,
  signer: OfflineSigner,
  address: string,
  { nftMaxSupply }: { nftMaxSupply?: number } = {},
  memo?: string
) {
  const signingClient = await getSigningClient();
  await signingClient.connectWithSigner(RPC_URL, signer)
  let classConfig: any = null;
  if (nftMaxSupply) classConfig = { nftMaxSupply };

  let { uri } = data;
  const isUriHttp = uri && uri.startsWith('https://');
  if (isUriHttp) uri = addParamToUrl(uri, { iscn_id: iscnId });
  const res = await signingClient.createNFTClass(
    address,
    iscnId,
    {
      ...data,
      uri,
    },
    classConfig,
    { memo },
  );
  const rawLogs = JSON.parse((res as DeliverTxResponse).rawLog || '');
  const event = rawLogs[0].events.find(
    (e: any) => e.type === 'likechain.likenft.v1.EventNewClass',
  );
  const attribute = event.attributes.find((a) => a.key === 'class_id');
  const classId = ((attribute && attribute.value) || '').replace(/^"(.*)"$/, '$1');
  return classId;
}

export async function signCreateRoyltyConfig(
  classId: string,
  iscnData: ISCNRecordData,
  iscnOwner: string,
  isUpdate: boolean,
  signer: OfflineSigner,
  address: string
) {
  try {
    const rateBasisPoints = royaltyRateBasisPoints;
    const feeAmount = royaltyFeeAmount;
    const totalAmount = royaltyUserAmount;
    const signingClient = await getSigningClient();
    await signingClient.connectWithSigner(RPC_URL, signer);
    const rewardMap = await parseAndCalculateStakeholderRewards(
      iscnData,
      iscnOwner,
      {
        precision: 0,
        totalAmount,
      }
    );
    const rewards = Array.from(rewardMap.entries());
    const stakeholders = rewards.map((r) => {
      const [address, { amount }] = r;
      return {
        account: address,
        weight: parseInt(amount, 10),
      };
    });
    stakeholders.push({
      account: LIKER_NFT_FEE_WALLET,
      weight: feeAmount,
    });
    if (isUpdate) {
      await signingClient.createRoyaltyConfig(address, classId, {
        rateBasisPoints,
        stakeholders,
      });
    } else {
      await signingClient.createRoyaltyConfig(address, classId, {
        rateBasisPoints,
        stakeholders,
      });
    }
  } catch (err) {
    // Don't throw on royalty create, not critical for now
    // eslint-disable-next-line no-console
    console.error(err);
  }
}
