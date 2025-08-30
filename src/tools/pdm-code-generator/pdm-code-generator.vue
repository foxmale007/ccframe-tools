<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';
import { NCheckbox } from 'naive-ui';
import JSZip from 'jszip';
import _ from 'lodash';
import { pdmToJson } from './pdm-service';
import { UUIDFormat, uuid } from './uuidGen';
import { generateAndZipData } from './genTemplate';

// 导入 nabiveUi的TableColumns类型
const BASE_PACKAGE = 'org.ccframe.subsys';

const file = ref<File | null>(null);
const status = ref<'idle' | 'parsed' | 'error' | 'loading'>('idle');
const pdmJson = ref<any>(null);
const physicalDiagram = ref<any[]>([]);
const diagramTables: Ref<any[]> = ref<any[]>([]);
const checkedRowKeys = ref<Array<string | number>>([]);
const genLog = ref<string[]>([]);
const packageName = ref('somepackage');
const validationRules = [{ message: '输入小写字符', validator: (value: string) => /^[a-z]+$/.test(value) }];
const canGenerate = computed(() => checkedRowKeys.value.length > 0 && /^[a-z]+$/.test(packageName.value));
const blobUrl = ref<string>('');

watch(checkedRowKeys, (newKeys, oldKeys) => {
  // 计算新增/移除的 key
  console.log('change checkedRowKeys', newKeys, oldKeys);
  const added = newKeys.filter(k => !oldKeys.includes(k));
  const removed = oldKeys.filter(k => !newKeys.includes(k));

  added.forEach((key) => {
    const row = diagramTables.value.find((item: any) => item.key === key);
    if (row) {
      row.genIndex = true;
      row.checked = true;
    }
  });
  removed.forEach((key) => {
    const row = diagramTables.value.find((item: any) => item.key === key);
    if (row) {
      row.genIndex = false;
      row.checked = false;
    }
  });
});

const tableColumns: DataTableColumns<any> = [
  {
    type: 'selection',
  },
  { title: '表名', key: 'name' },
  { title: '表代码', key: 'code' },
  {
    title: '开启索引',
    key: 'genIndex',
    render: (row) => {
      return h(NCheckbox, { checked: row.genIndex, onUpdateChecked: (value: boolean) => { console.log(value); row.genIndex = value; } });
    },
  },
];

const physicalDiagramList = computed(() => {
  const diagrams = pdmJson.value?.diagrams;
  if (!diagrams || !Array.isArray(diagrams)) {
    return [{ label: '未选择', value: '' }];
  }
  const result = diagrams.map((diagram: any) => ({
    label: diagram.name,
    value: diagram.code,
  }));
  nextTick(() => {
    const defaultDiagram = diagrams.find((item: any) => item.default);
    const defaultDiagramValue = defaultDiagram?.code;
    const defaultResultItem = result.find((item: any) => item.value === defaultDiagramValue);
    physicalDiagram.value = defaultResultItem ? defaultResultItem.value : result[0].value;
    const tableCodes: string[] = defaultDiagram.tables;

    // 在tables里filter出tableCodes对应的code的表
    const tables = pdmJson.value?.tables;
    if (tables && Array.isArray(tables)) {
      diagramTables.value = tables.filter((table: any) => tableCodes.includes(table.code)).map((table: any) => {
        table.key = table.code.replace(/^[A-Z]+_/, ''); // 添加唯一的key属性,并且把第一个下划线前的前缀去掉
        table.genIndex = false;
        table.checked = false;
        return table;
      });
      console.log(diagramTables.value);
    }
  });
  return result;
});
async function onPdmUpload(uploadedFile: File) {
  file.value = uploadedFile;
  const fileBuffer = await uploadedFile.arrayBuffer();
  status.value = 'loading';

  try {
    // arrayBuffer转化为string
    const fileString = new TextDecoder().decode(fileBuffer);
    pdmJson.value = pdmToJson(fileString);
    packageName.value = file.value.name.split('\.')[0];
    console.log('pdmJson.value', pdmJson.value);
    status.value = 'parsed';
  }
  catch (e) {
    status.value = 'error';
  }
}

function clearFile() {
  file.value = null;
  pdmJson.value = null;
  status.value = 'idle';
}
async function generateJavaCode() {
  // 生成索引key
  diagramTables.value.forEach((table: any) => {
    if (table.indexs) {
      table.indexs.forEach((index: any) => {
        index.key = uuid(UUIDFormat.UUID25Base36);
      });
    }
  });
  const zip = new JSZip();
  const logs: string[] = generateAndZipData(BASE_PACKAGE, packageName.value, zip, diagramTables.value);
  genLog.value.splice(0, genLog.value.length, ...logs);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  blobUrl.value = URL.createObjectURL(blob);
  console.log('generateJavaCode>>', blobUrl.value);
}

function downloadZip() {
  const zipName = `${new Date().toISOString().replace(/[-T:.Z]/g, '')}.zip`;
  const a = document.createElement('a');
  a.href = blobUrl.value; a.download = zipName; a.className = 'dl';
  a.textContent = `⬇️ 下载 ${zipName}`;
  setTimeout(() => { a.click(); }, 200);
}
</script>

<template>
  <div w-full flex flex-row important:flex-1 important:pa-0>
    <c-card title="模型文件输入" mr-10px flex-1>
      <div v-if="file">
        <div class="flex items-center justify-between rounded-lg bg-gray-100 p-4">
          <span>{{ file.name }}</span>
          <c-button
            variant="text"
            circle
            @click="clearFile"
          >
            <icon-mdi-close-thick />
          </c-button>
        </div>
        <div class="mt-5 flex flex-row items-center gap-2 border-b border-gray-200 border-b-solid pb-2">
          <span text-16px font-medium>选择要生成的表</span>
          <div flex-1 />
          <span>选择物理视图</span>
          <c-select
            v-model:value="physicalDiagram"
            :options="physicalDiagramList"
            placeholder="Select a language"
            w-200px
          />
        </div>

        <n-data-table
          v-model:checked-row-keys="checkedRowKeys"
          size="small"
          :columns="tableColumns"
          :data="diagramTables"
        />
        <div class="mt-5 flex flex-row gap-3">
          <c-input-text
            v-model:value="packageName"
            label-width="100px"
            label-position="left"
            label="业务包名"
            :validation-rules="validationRules"
            mb-2 max-w-300px
          />
        </div>

        <div mt-5 flex justify-center gap-3>
          <c-button size="large" type="primary" :disabled="!canGenerate" @click="generateJavaCode()">
            <icon-mdi-language-java mr-1 text-24px /> 生成JAVA代码
          </c-button>
        </div>
      </div>
      <c-file-upload v-else title="Drag and drop a PDM file here, or click to select a file" accept=".pdm" @file-upload="onPdmUpload" />
    </c-card>
    <c-card title="代码文件生成" flex-1>
      <div v-if="genLog.length > 0">
        <pre>
<div v-for="item in genLog" :key="item">{{ item }}</div>
        </pre>
        <div mt-5 flex justify-center gap-3>
          <c-button size="large" type="primary" :disabled="blobUrl.length === 0" @click="downloadZip()">
            <icon-mdi-compressed-file mr-1 text-24px /> 打包下载
          </c-button>
        </div>
      </div>
      <div v-else flex flex-row items-center gap-1>
        <icon-mdi-information-slab-box :size="8" color="orange" />
        <span color="orange-6">{{ diagramTables.length > 0 ? '请点击生成JAVA代码' : '请先上传PDM文件' }}</span>
      </div>
    </c-card>
  </div>
</template>
