export const { IS_TESTNET } = process.env;
export const LIKECOIN_CHAIN_RPC_URL = IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';
export const LIKE_CO_API = IS_TESTNET ? 'https://api.rinkeby.like.co' : 'https://api.like.co';
export const APP_LIKE_CO_URL = IS_TESTNET ? 'https://app.rinkeby.like.co' : 'https://app.like.co';
export const LIKER_LAND_URL = IS_TESTNET ? 'https://rinkeby.liker.land' : 'https://liker.land';
export const DENOM = IS_TESTNET ? 'nanoekil' : 'nanolike';
export const CHAIN_ID = IS_TESTNET ? 'likecoin-testnet-5' : 'likecoin-mainnet-2';

export const DEFAULT_CSV = 'list.csv';
export const GAS_PRICE = 10000;

export const MNEMONIC = '';
export const NFT_PREFIX = '';
export const CLASS_SYMBOL = '';
export const NFT_META_COLLECTION_ID = '';
export const NFT_META_COLLECTION_NAME = '';
export const NFT_META_COLLECTION_DESCRIPTION = '';

export const SUCCESS_URL = '';
export const CANCEL_URL = '';
export const MODERATOR_WALLETS = [];
export const NOTIFICATION_EMAILS = [];
export const CONNECTED_WALLETS = [];
