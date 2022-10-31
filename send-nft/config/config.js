export const MNEMONIC = '';
export const MEMO = '';
export const WAIT_TIME = 10000; // In ms

export const DENOM = process.env.IS_TESTNET ? 'nanoekil' : 'nanolike';
export const RPC_ENDPOINT = process.env.IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';
