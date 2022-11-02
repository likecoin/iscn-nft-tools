export const { MNEMONIC, IS_TESTNET } = process.env;
export const DENOM = IS_TESTNET ? 'nanoekil' : 'nanolike';
export const RPC_ENDPOINT = IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';
