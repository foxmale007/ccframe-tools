import { type MaybeRef, get } from '@vueuse/core';
import Fuse from 'fuse.js';
import { computed, ref, watch } from 'vue';

export { useFuzzySearch };

function useFuzzySearch<Data>({
  search,
  data,
  options = {},
}: {
  search: MaybeRef<string>
  data: MaybeRef<Data[]>
  options?: Fuse.IFuseOptions<Data> & { filterEmpty?: boolean }
}) {
  const dataRef = ref(get(data));
  const fuse = new Fuse<Data>(dataRef.value as readonly Data[], options);
  const filterEmpty = options.filterEmpty ?? true;

  // 监听 data 的变化，更新 fuse 的数据源
  watch(() => get(data), (newDataArray) => {
    dataRef.value = newDataArray;
    fuse.setCollection(newDataArray);
  });

  const searchResult = computed(() => {
    const query = get(search);

    if (!filterEmpty && query === '') {
      return dataRef.value;
    }

    return fuse.search(query).map(({ item }) => item);
  });

  return { searchResult };
}
