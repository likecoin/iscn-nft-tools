<template>
  <div>
    <h1>Mint LikeCoin NFT/NFT Book</h1>
    <div v-if="error">{{ error }}</div>
    <div>Steps {{ step }} / 3</div>
    <hr/>
    <section v-if="step === 1">
      <h2>1. Select or Create ISCN</h2>
      <div>
        <p><label>Enter ISCN ID or NFT Class ID:</label></p>
        <input v-model="iscnIdInput" placeholder="iscn://... or likenft....">
        <button @click="onISCNIDInput">Submit</button>
      </div>
      <br/>
      <br/>
        or
      <br/>
      <div>
        <p><label>Upload ISCN data json file: </label></p>
        <input type="file" @change="onISCNFileChange" />
        <button @click="onISCNFileInput">Create</button>
      </div>
    </section>
    <section v-else-if="step > 1">
      <h3>ISCN Information</h3>
      <p>ISCN ID:
        <a
          target="_blank"
          :href="`${appLikeCoURL}/iscn/${encodeURIComponent(iscnId)}`"
        >
          {{ iscnId }}
        </a>
      </p>
      <p>ISCN Owner:
        <a
          target="_blank"
          :href="`${likerLandURL}/${encodeURIComponent(iscnOwner)}`"
        >{{ iscnOwner }}</a>
      </p>
      <p>ISCN Title: {{ iscnData?.contentMetadata?.name }}</p>
      <hr/>
    </section>
    <section v-if="step === 2">
      <h2>2. Create NFT Class</h2>
      <div>
        <label>Max number of supply for this NFT Class (optional):</label>
        <input v-model="classMaxSupply" type="number" />
        <p><label>Upload NFT Class data json file: </label></p>
        <input type="file" @change="onClassFileChange"/>
        <button @click="onClassFileInput">Create</button>
      </div>
    </section>
    <section v-else-if="step > 2">
      <h3>NFT Class Information</h3>
      <p>NFT Class ID:
        <a
          target="_blank"
          :href="`${likerLandURL}/nft/class/${encodeURIComponent(classData?.id)}`"
        >
          {{ classData?.id }}
        </a>
      </p>
      <hr/>
    </section>
    <section v-if="step === 3">
      <h2>3. Mint ISCN</h2>

    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useWalletStore } from '~/stores/wallet';
import { LCD_URL, APP_LIKE_CO_URL, LIKER_LAND_URL } from '~/constant';

const store = useWalletStore();
const { wallet, signer } = storeToRefs(store);
const { connect } = store;

const appLikeCoURL = APP_LIKE_CO_URL;
const likerLandURL = LIKER_LAND_URL;
const step = ref(1);
const error = ref('')

const iscnIdInput = ref('')
const iscnOwner = ref('')
const iscnCreateData = ref<any>(null)
const iscnData = ref<any>(null)

const classData = ref<any>(null)
const classMaxSupply = ref(0)
const classCreateData = ref<any>(null)
const nftData = ref<any>(null)

const iscnId = computed(() => iscnData.value?.['@id'])

onMounted(async () => {

})

async function onISCNIDInput() {
  try {
    if (iscnIdInput.value.startsWith('iscn://')) {
      const { data } = await useFetch(`${LCD_URL}/iscn/records/id?iscn_id=${encodeURIComponent(iscnIdInput.value)}`)
      if (!data) throw new Error ('INVALID_ISCN_ID')
      const { records, owner } = data.value as any;
      iscnData.value = records[0].data
      iscnOwner.value = owner
      step.value = 2
    } else if (iscnIdInput.value.startsWith('likenft')) {
      const { data } = await useFetch(`${LCD_URL}/cosmos/nft/v1beta1/classes/${encodeURIComponent(iscnIdInput.value)}`)
      if (!data) throw new Error ('INVALID_NFT_CLASS_ID')
      classData.value = (data.value as any).class
      const parentIscnId = classData.value?.data?.parent?.iscn_id_prefix
      const { data: resISCN } = await useFetch(`${LCD_URL}/iscn/records/id?iscn_id=${encodeURIComponent(parentIscnId)}`)
      const { records, owner } = resISCN.value as any;;
      iscnData.value = records[0].data
      iscnOwner.value = owner
      step.value = 3
    } else {
      throw new Error('Invalid ISCN ID or NFT Class ID')
    }
  } catch (err) {
    console.error(err);
    error.value = err;
  }
}

async function onISCNFileInput() {
  try {
    if (!wallet.value || !signer.value) {
      await connect();
    }
    if (!wallet.value || !signer.value) return;
    const newIscnId = await signCreateISCNRecord(iscnCreateData.value, signer.value, wallet.value);
    const { data } = await useFetch(`${LCD_URL}/iscn/records/id?iscn_id=${encodeURIComponent(newIscnId)}`)
    if (!data) throw new Error ('INVALID_ISCN_ID')
    const { records, owner } = data.value as any;
    iscnData.value = records[0].data
    iscnOwner.value = owner
    step.value = 2
  } catch (err) {
    console.error(err);
    error.value = err;
  }
}

function onISCNFileChange(event: Event) {
  if (!event?.target) return;
  const files = (event.target as HTMLInputElement)?.files
  if (!files) return;
  const [file] = files;
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result
      if (typeof text !== 'string') return;
      const json = JSON.parse(text)
      iscnCreateData.value = json;
      onISCNFileInput();
    } catch (err) {
      console.error(err);
      error.value = err;
    }
  }
  reader.readAsText(file)
}

async function onClassFileInput() {
  try {
    if (!wallet.value || !signer.value) {
      await connect();
    }
    if (!wallet.value || !signer.value) return;
    const newClassId = await signCreateNFTClass(classCreateData.value, iscnId.value, signer.value, wallet.value);
    await signCreateRoyltyConfig(newClassId, iscnData.value, iscnOwner.value, false, signer.value, wallet.value);
    const { data } = await useFetch(`${LCD_URL}/cosmos/nft/v1beta1/classes/${encodeURIComponent(newClassId)}`)
    if (!data) throw new Error ('INVALID_NFT_CLASS_ID')
    classData.value = (data.value as any).class
    step.value = 3
  } catch (err) {
    console.error(err);
    error.value = err;
  }
}

function onClassFileChange(event: Event) {
  if (!event?.target) return;
  const files = (event.target as HTMLInputElement)?.files
  if (!files) return;
  const [file] = files;
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result
      if (typeof text !== 'string') return;
      const json = JSON.parse(text)
      classCreateData.value = json;
      onClassFileInput();
    } catch (err) {
      console.error(err);
      error.value = err;
    }
  }
  reader.readAsText(file)
}

</script>
