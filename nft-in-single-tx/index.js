import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ISCNSigningClient } from '@likecoin/iscn-js';
import { formatMsgCreateIscnRecord } from '@likecoin/iscn-js/dist/messages/iscn.js';
import { formatMsgNewClass, formatMsgMintNFT } from '@likecoin/iscn-js/dist/messages/likenft.js';
import { getISCNIdPrefix } from '@likecoin/iscn-js/dist/iscn/iscnId.js';
import { calculateNFTClassIdByISCNId } from '@likecoin/iscn-js/dist/nft/nftId.js';

const { IS_TESTNET, MNEMONIC } = process.env;
const LIKECOIN_CHAIN_RPC_ENDPOINT = IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';

const signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: 'like' });
const [firstAccount] = await signer.getAccounts();
const { address } = firstAccount;
const client = new ISCNSigningClient();
await client.connectWithSigner(LIKECOIN_CHAIN_RPC_ENDPOINT, signer);

const contentMetadata = {
  '@context': 'http://schema.org/',
  '@type': 'CreativeWorks',
  title: '使用矩陣計算遞歸關係式',
  description: 'An article on computing recursive function with matrix multiplication.',
  datePublished: '2023-07-17',
  version: 1,
  url: 'https://nnkken.github.io/post/recursive-relation/',
  author: 'https://github.com/nnkken',
  usageInfo: 'https://creativecommons.org/licenses/by/4.0',
  keywords: 'matrix,recursion',
};

const iscnSignPayload = {
  recordNotes: 'POC',
  contentFingerprints: ['hash://sha256/9564b85669d5e96ac969dd0161b8475bbced9e5999c6ec598da718a3045d6f2e'],
  stakeholders: [
    {
      entity: {
        '@id': 'did:cosmos:5sy29r37gfxvxz21rh4r0ktpuc46pzjrmz29g45',
        name: 'Chung Wu',
      },
      rewardProportion: 95,
      contributionType: 'http://schema.org/author',
    },
    {
      rewardProportion: 5,
      contributionType: 'http://schema.org/citation',
      footprint: 'https://en.wikipedia.org/wiki/Fibonacci_number',
      description: 'The blog post referred the matrix form of computing Fibonacci numbers.',
    }
  ],
  contentMetadata: {
    '@context': 'http://schema.org/',
    '@type': 'CreativeWorks',
    title: '使用矩陣計算遞歸關係式',
    description: 'An article on computing recursive function with matrix multiplication.',
    datePublished: '2023-07-17',
    version: 1,
    url: 'https://nnkken.github.io/post/recursive-relation/',
    author: 'https://github.com/nnkken',
    usageInfo: 'https://creativecommons.org/licenses/by/4.0',
    keywords: 'matrix,recursion',
  },
};

const iscnIdPrefix = `iscn://likecoin-chain/${getISCNIdPrefix(address, iscnSignPayload)}`;
const newNFTClassData = {
  name: contentMetadata.title,
  symbol: 'NOT-WRITING',
  description: contentMetadata.description,
};

const classId = calculateNFTClassIdByISCNId(iscnIdPrefix);
const mintNFTData = {
  id: 'likenft1poc001',
  uri: 'https://example.com/'
}

const messages = [
  formatMsgCreateIscnRecord(address, iscnSignPayload),
  formatMsgNewClass(address, iscnIdPrefix, newNFTClassData),
  formatMsgMintNFT(address, classId, mintNFTData),
]

const res = await client.sendMessages(address, messages);
