<template>
  <div>
    <h1>Send NFT</h1>
    <div v-if="error" style="color: red">
      {{ error }}
    </div>
    <div v-if="isLoading" style="color: green">
      Loading...
    </div>
    <div>Steps {{ step }} / 2</div>
    <hr>
    <section v-if="step === 1">
      <h2>1. Send NFT</h2>
      <div>
        <p><label>Enter default memo (optional)</label></p>
        <input v-model="defaultMemo" placeholder="default memo">
        <p><label>Upload NFT CSV (list.csv) file: </label></p>
        <div v-if="nftSendListData?.length">
          <pre>Number of NFT data in CSV:{{ nftSendListData?.length }}</pre>
          Summary
          <table>
            <thead>
              <tr><td>Class ID</td><td>Count</td></tr>
            </thead>
            <tbody>
              <tr v-for="entry in Object.entries(nftCountObject)" :key="entry[0]">
                <td>{{ entry[0] }}</td><td>{{ entry[1] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <input type="file" @change="onSendNFTFileChange">
        <br>
        <button :disabled="isLoading" style="margin-top: 16px" @click="onSendNFTStart">
          Send
        </button>
      </div>
    </section>

    <section v-if="step > 1">
      Result:
      <table>
        <thead>
          <tr><td>Address</td><td>Class ID</td><td>Memo</td><td>Status</td></tr>
        </thead>
        <tbody>
          <tr v-for="entry in nftResultData" :key="entry[0]">
            <td>{{ entry.address }}</td>
            <td>{{ entry.classId }}</td>
            <td>{{ entry.memo }}</td>
            <td>{{ entry.status }}</td>
          </tr>
        </tbody>
      </table>
      <button :disabled="isLoading" @click="onDownloadCSV">
        Download NFT result csv
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { parse } from 'csv-parse/sync'
import { formatMsgSend } from '@likecoin/iscn-js/dist/messages/likenft'
import { TimeoutError } from '@cosmjs/stargate'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { stringify } from 'csv-stringify/sync'

import { getNFTs } from '~/utils/cosmos'
import { useWalletStore } from '~/stores/wallet'

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { connect } = store

const step = ref(1)
const error = ref('')
const isLoading = ref(false)

const defaultMemo = ref('')
const nftSendListData = ref<any>([])
const nftResultData = ref<any>([])

const nftCountObject = computed(() => {
  return nftSendListData.value.reduce((object: any, item: any) => {
    object[item.classId] = (object[item.classId] || 0) + 1
    return object
  }, {})
})
const nftIdObject = computed(() => {
  return nftSendListData.value.reduce((object: any, item: any) => {
    if (item.nftId) {
      object[item.classId] = object[item.classId] || []
      object[item.classId].push(item.nftId)
    }
    return object
  }, {})
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
    if (!nftSendListData.value.length) { throw new Error('NFT data not exists') }
    const nftsDataObject: any = {}
    for (let i = 0; i < Object.keys(nftCountObject.value).length; i += 1) {
      const classId = Object.keys(nftCountObject.value)[i]
      const needCount = nftCountObject.value[classId]
      const { nfts } = await getNFTs({
        classId,
        owner: wallet.value,
        needCount
      })
      nftsDataObject[classId] = nfts
      if (needCount > nftsDataObject[classId].length) {
        throw new Error(`NFT classId: ${classId} (own quantity: ${nftsDataObject[classId].length}), Will send ${needCount} counts, NFT not enough!`)
      }
      if (nftIdObject.value[classId]) {
        for (let j = 0; j < nftIdObject.value[classId].length; j += 1) {
          const nftId = nftIdObject.value[classId][j]
          const { owner } = await getNFTOwner(classId, nftId)
          if (owner !== wallet.value) {
            throw new Error(`NFT classId: ${classId} nftId:${nftId} is not owned by sender!`)
          }
        }
        nftsDataObject[classId] = nftsDataObject[classId]
          .filter((nft: any) => !nftIdObject.value[classId].includes(nft.id))
      }
    }

    const signingClient = await getSigningClientWithSigner(signer.value)
    const client = signingClient.getSigningStargateClient()
    if (!client) { throw new Error('Signing client not exists') }

    const hasCsvMemo = nftSendListData.value.some((e: any) => e.memo)

    const { accountNumber, sequence } = await client.getSequence(wallet.value)
    const chainId = await client.getChainId()

    step.value += 1
    const msgAnyArray = []
    let currentSequence = sequence
    for (let i = 0; i < nftSendListData.value.length; i += 1) {
      const e = nftSendListData.value[i]
      let targetNftId = e.nftId
      if (!targetNftId) {
        const removed = nftsDataObject[e.classId].splice(0, 1)
        targetNftId = removed[0].id
      }
      nftResultData.value[i].nftId = targetNftId
      const msgSend = formatMsgSend(
        wallet.value,
        e.address,
        e.classId,
        targetNftId
      )
      if (hasCsvMemo) {
        const tx = await client.sign(
          wallet.value,
          [msgSend],
          getGasFee(1),
          e.memo || defaultMemo.value,
          {
            accountNumber,
            sequence: currentSequence,
            chainId
          }
        )
        nftResultData.value[i].status = 'signed'
        currentSequence += 1
        try {
          const txBytes = TxRaw.encode(tx).finish()
          const res = await client.broadcastTx(txBytes, 1000, 1000)
          nftResultData.value[i].status = `broadcasted ${res.transactionHash}`
        } catch (err) {
          if (err instanceof TimeoutError) {
            nftResultData.value[i].status = `broadcasted ${err.txId}`
          } else {
            nftResultData.value[i].status = `error ${(err as Error).toString()}`
            throw err
          }
        }
      } else {
        msgAnyArray.push(msgSend)
      }
    }

    if (msgAnyArray.length) {
      const result = await client.signAndBroadcast(
        wallet.value,
        msgAnyArray,
        getGasFee(nftSendListData.value.length),
        defaultMemo.value
      )
      for (let i = 0; i < nftSendListData.value.length; i += 1) {
        nftResultData.value[i].status = `broadcasted ${result.transactionHash}`
      }
    }
  } catch (err) {
    console.error(err)
    error.value = (err as Error).toString()
  } finally {
    isLoading.value = false
  }
}

function onSendNFTFileChange (event: Event) {
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
      nftSendListData.value = data
      nftResultData.value = data
    } catch (err) {
      console.error(err)
      error.value = (err as Error).toString()
    }
  }
  reader.readAsText(file)
}

function onDownloadCSV () {
  downloadBlob(stringify(nftResultData.value), 'result.csv', 'text/csv;charset=utf-8;')
}

</script>
