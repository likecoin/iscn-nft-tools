export const { MNEMONIC, PRIVATE_KEY, IS_TESTNET } = process.env;
export const MEMO = '';
export const WAIT_TIME = 10000; // In ms

export const DENOM = IS_TESTNET ? 'nanoekil' : 'nanolike';
export const RPC_ENDPOINT = IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';
