import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx.js';
import fs from 'fs';
import neatCsv from 'neat-csv';
import BigNumber from 'bignumber.js';

////////////// use your mnemonic phrase //////////////
const mnemonic = process.env.MNEMONIC;
////////////// use your desired memo //////////////
const memo = process.env.MEMO || '';
////////////// adjust delay //////////////
const waitTime = Number(10000)

const DEFAULT_GAS_AMOUNT = 200000;
const DEFAULT_GAS_PRICE = 10000;

const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'like' });
const [firstAccount] = await wallet.getAccounts();

const rpcEndpoint = process.env.IS_TESTNET ? 'https://node.testnet.like.co/rpc/' : 'https://mainnet-node.like.co/rpc/';
const denom = process.env.IS_TESTNET ? "nanoekil" : "nanolike"

const client = await SigningStargateClient.connectWithSigner(
	rpcEndpoint,
	wallet,
);

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readCsv(path) {
	const csv = fs.readFileSync(path);
	const data = await neatCsv(csv);
	return data;
}

async function run() {
	const data = await readCsv('list.csv');
	let total = 0
	const msgArray = data.map((e) => {
		total += Number(e.LIKE)
		return MsgSend.fromPartial({
			fromAddress: firstAccount.address,
			toAddress: e.address,
			amount: [{
				denom: denom,
				amount: `${new BigNumber(e.LIKE).shiftedBy(9).toFixed(0)}`,
			}],
		});
	})
	const msgAnyArray = msgArray.map((e) => {
		return {
			typeUrl: "/cosmos.bank.v1beta1.MsgSend",
			value: e,
		}
	})

	const fee = {
		amount: [
			{
				denom,
				amount: new BigNumber(msgAnyArray.length)
					.multipliedBy(DEFAULT_GAS_AMOUNT)
					.multipliedBy(DEFAULT_GAS_PRICE)
					.toFixed(0),
			},
		],
		gas: new BigNumber(msgAnyArray.length)
			.multipliedBy(DEFAULT_GAS_AMOUNT)
			.toFixed(0),
	};

	console.log('total:', total)
	console.log('Terminate if not expected (control+c)')
	await sleep(waitTime)

	const result = await client.signAndBroadcast(
		firstAccount.address,
		msgAnyArray,
		fee,
		memo
	);
	console.log(result)
}
run()
