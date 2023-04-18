<template>
  <div>
    <header>
      <div style="display: flex; flex-wrap:wrap; background-color:#28646e; color: white; padding: 20px;">
        <h1>LikeCoin ISCN/NFT Tools</h1>
        <div style="flex: 1" />
        <WalletHeader />
      </div>
    </header>
    <div style="margin: 10px">
      <slot />
    </div>
  </div>
</template>
<style>
body {
    margin: 0;
}

h1 {
    display: inline-block;
}

table,
td,
th {
    border-collapse: collapse;
    border: 1px solid;
}

footer {
    padding: 12px 12px 20px;

    display: flex;
    gap: 10px;
}
</style>
