export const { IS_TESTNET } = process.env;
export const LIKECOIN_CHAIN_RPC_URL = IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';
export const LIKE_CO_API = IS_TESTNET ? 'https://api.rinkeby.like.co' : 'https://api.like.co';
export const APP_LIKE_CO_URL = IS_TESTNET ? 'https://app.rinkeby.like.co' : 'https://app.like.co';
export const LIKER_LAND_URL = IS_TESTNET ? 'https://rinkeby.liker.land' : 'https://liker.land';
export const DENOM = IS_TESTNET ? 'nanoekil' : 'nanolike';
export const CHAIN_ID = IS_TESTNET ? 'likecoin-testnet-5' : 'likecoin-mainnet-2';
export const LIKER_NFT_FEE_WALLET = IS_TESTNET
  ? 'like1yney2cqn5qdrlc50yr5l53898ufdhxafqz9gxp'
  : 'like10ywsmztkxjl55xarxnhlxwc83z9v2hkxtsajwl'

export const DEFAULT_CSV = 'list.csv';
export const GAS_PRICE = 10000;

export const MNEMONIC = '';
export const PRIVATE_KEY = '';
export const NFT_PREFIX = 'BOOK';
export const CLASS_SYMBOL = 'BOOK';
export const NFT_META_COLLECTION_ID = 'nft_book';
export const NFT_META_COLLECTION_NAME = 'NFT Book';
export const NFT_META_COLLECTION_DESCRIPTION = 'NFT Book by Liker Land';

export const SUCCESS_URL = '';
export const CANCEL_URL = '';
export const MODERATOR_WALLETS = [];
export const NOTIFICATION_EMAILS = [];
export const CONNECTED_WALLETS = [];
