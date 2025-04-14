<template>
  <div>
    <h1>Send LIKE</h1>
    <div v-if="error" style="color: red">
      {{ error }}
    </div>
    <div v-if="isLoading" style="color: green">
      Loading...
    </div>
    <div>Steps {{ step }} / 2</div>
    <hr>
    <section v-if="step === 1">
      <h2>1. Send LIKE</h2>
      <div>
        <p><label>Enter default memo (optional)</label></p>
        <input v-model="defaultMemo" placeholder="default memo">
        <p>
          <label>Upload LIKE CSV (
            <a
              href="https://github.com/likecoin/iscn-nft-tools/blob/master/send-like/list_example.csv"
              target="_blank"
            >
              list.csv
            </a>) file: </label>
        </p>
        <div v-if="likeSendListData?.length">
          <pre>Number of entries in CSV:{{ likeSendListData.length }}</pre>
          <pre>Total amount:{{ totalAmount }}</pre>
          <table>
            <thead>
              <tr><td>Address</td><td>LIKE</td></tr>
            </thead>
            <tbody>
              <tr v-for="entry in likeSendListData" :key="entry.address">
                <td>{{ entry.address }}</td><td>{{ entry.LIKE }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <input type="file" @change="onSendLIKEFileChange">
        <br>
        <button :disabled="isLoading" style="margin-top: 16px" @click="onSendNFTStart">
          Send
        </button>
      </div>
    </section>

    <section v-if="step > 1">
      Result: {{ sendResultTxHash }}
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { parse } from 'csv-parse/sync'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx.js'

import { BigNumber } from 'bignumber.js'
import { useWalletStore } from '~/stores/wallet'
import { DENOM } from '~/constant'

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { connect } = store

const step = ref(1)
const error = ref('')
const isLoading = ref(false)

const defaultMemo = ref('')
const likeSendListData = ref<any>([])
const sendResultTxHash = ref('')

const totalAmount = computed(() => {
  return likeSendListData.value.reduce((total: any, item: any) => {
    return total + Number(item.LIKE)
  }, 0)
})

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

async function onSendNFTStart () {
  try {
    isLoading.value = true
    if (!wallet.value || !signer.value) {
      await connect()
    }
    if (!wallet.value || !signer.value) { return }
    if (!likeSendListData.value.length) { throw new Error('NFT data not exists') }
    const signingClient = await getSigningClientWithSigner(signer.value)
    const client = signingClient.getSigningStargateClient()
    if (!client) { throw new Error('Signing client not exists') }

    step.value += 1
    const msgAnyArray = []
    for (let i = 0; i < likeSendListData.value.length; i += 1) {
      const e = likeSendListData.value[i]
      const msgSend = MsgSend.fromPartial({
        fromAddress: wallet.value,
        toAddress: e.address,
        amount: [{
          denom: DENOM,
          amount: `${new BigNumber(e.LIKE).shiftedBy(9).toFixed(0)}`
        }]
      })
      msgAnyArray.push(msgSend)
    }

    if (msgAnyArray.length) {
      const result = await client.signAndBroadcast(
        wallet.value,
        msgAnyArray.map(e => ({
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: e
        })),
        getGasFee(likeSendListData.value.length),
        defaultMemo.value
      )
      sendResultTxHash.value = result.transactionHash
    }
  } catch (err) {
    console.error(err)
    error.value = (err as Error).toString()
  } finally {
    isLoading.value = false
  }
}

function onSendLIKEFileChange (event: Event) {
  if (!event?.target) { return }
  const files = (event.target as HTMLInputElement)?.files
  if (!files) { return }
  const [file] = files
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result
      if (typeof text !== 'string') { return }
      const data = parse(text, { columns: true })
      likeSendListData.value = data
      sendResultTxHash.value = ''
    } catch (err) {
      console.error(err)
      error.value = (err as Error).toString()
    }
  }
  reader.readAsText(file)
}

</script>
