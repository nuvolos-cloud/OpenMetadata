/*
 *  Copyright 2023 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { cloneDeep, isNil, isString } from 'lodash';
import Qs from 'qs';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Config,
  FieldGroup,
  ImmutableTree,
  JsonTree,
  Utils as QbUtils,
  ValueSource,
} from 'react-awesome-query-builder';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import {
  emptyJsonTree,
  getQbConfigs,
} from '../../../constants/AdvancedSearch.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { elasticSearchFormat } from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { getEntityTypeFromSearchIndex } from '../../../utils/SearchUtils';
import Loader from '../../Loader/Loader';
import { AdvancedSearchModal } from '../AdvanceSearchModal.component';
import { ExploreSearchIndex, UrlParams } from '../ExplorePage.interface';
import {
  AdvanceSearchContext,
  AdvanceSearchProviderProps,
} from './AdvanceSearchProvider.interface';

const AdvancedSearchContext = React.createContext<AdvanceSearchContext>(
  {} as AdvanceSearchContext
);

export const AdvanceSearchProvider = ({
  children,
}: AdvanceSearchProviderProps) => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const location = useLocation();
  const history = useHistory();
  const { tab } = useParams<UrlParams>();
  const [loading, setLoading] = useState(true);
  const searchIndex = useMemo(() => {
    const tabInfo = Object.entries(tabsInfo).find(
      ([, tabInfo]) => tabInfo.path === tab
    );
    if (isNil(tabInfo)) {
      return SearchIndex.TABLE;
    }

    return tabInfo[0] as ExploreSearchIndex;
  }, [tab]);
  const [config, setConfig] = useState<Config>(getQbConfigs(searchIndex));

  const defaultTree = useMemo(
    () => QbUtils.checkTree(QbUtils.loadTree(emptyJsonTree), config),
    []
  );

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substr(1)
          : location.search
      ),
    [location.search]
  );

  const jsonTree = useMemo(() => {
    if (!isString(parsedSearch.queryFilter)) {
      return undefined;
    }

    try {
      const filter = JSON.parse(parsedSearch.queryFilter);
      const immutableTree = QbUtils.loadTree(filter as JsonTree);
      if (QbUtils.isValidTree(immutableTree)) {
        return filter as JsonTree;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }, [parsedSearch]);

  const [showModal, setShowModal] = useState(false);
  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(() =>
    jsonTree
      ? QbUtils.checkTree(QbUtils.loadTree(jsonTree), config)
      : defaultTree
  );
  const [queryFilter, setQueryFilter] = useState<
    Record<string, unknown> | undefined
  >();
  const [sqlQuery, setSQLQuery] = useState(
    treeInternal ? QbUtils.sqlFormat(treeInternal, config) ?? '' : ''
  );

  useEffect(() => {
    setConfig(getQbConfigs(searchIndex));
  }, [searchIndex]);

  const handleChange = useCallback(
    (nTree, nConfig) => {
      setConfig(nConfig);
      setTreeInternal(nTree);
    },
    [setConfig, setTreeInternal]
  );

  const handleTreeUpdate = useCallback(
    (tree?: ImmutableTree) => {
      history.push({
        pathname: location.pathname,
        search: Qs.stringify({
          ...parsedSearch,
          queryFilter: tree ? JSON.stringify(tree) : undefined,
          page: 1,
        }),
      });
    },
    [history, parsedSearch, location.pathname]
  );

  const toggleModal = (show: boolean) => {
    setShowModal(show);
  };

  const handleReset = useCallback(() => {
    setTreeInternal(QbUtils.checkTree(QbUtils.loadTree(emptyJsonTree), config));
    setQueryFilter(undefined);
    setSQLQuery('');
  }, []);

  const handleConfigUpdate = (updatedConfig: Config) => {
    setConfig(updatedConfig);
  };

  // Reset all filters, quick filter and query filter
  const handleResetAllFilters = useCallback(() => {
    setQueryFilter(undefined);
    setSQLQuery('');
    history.push({
      pathname: location.pathname,
      search: Qs.stringify({
        quickFilter: undefined,
        queryFilter: undefined,
        page: 1,
      }),
    });
  }, [history, location.pathname]);

  async function getCustomAttributesSubfields() {
    const updatedConfig = cloneDeep(config);
    try {
      const entityType = getEntityTypeFromSearchIndex(searchIndex);
      if (!entityType) {
        return;
      }
      const res = await getTypeByFQN(entityType);
      const customAttributes = res.customProperties;

      const subfields: Record<
        string,
        { type: string; valueSources: ValueSource[] }
      > = {};

      if (customAttributes) {
        customAttributes.forEach((attr) => {
          subfields[attr.name] = {
            type: 'text',
            valueSources: ['value'],
          };
        });
      }
      (updatedConfig.fields.extension as FieldGroup).subfields = subfields;

      return updatedConfig;
    } catch (error) {
      // Error
      return updatedConfig;
    }
  }

  const loadTree = useCallback(
    async (treeObj: JsonTree) => {
      const updatedConfig = (await getCustomAttributesSubfields()) ?? config;
      const tree = QbUtils.checkTree(QbUtils.loadTree(treeObj), updatedConfig);
      setTreeInternal(tree);
      const qFilter = {
        query: elasticSearchFormat(tree, updatedConfig),
      };
      setQueryFilter(qFilter);
      setSQLQuery(QbUtils.sqlFormat(tree, updatedConfig) ?? '');
    },
    [config]
  );

  useEffect(() => {
    if (jsonTree) {
      loadTree(jsonTree);
    } else {
      handleReset();
    }

    setLoading(false);
  }, [jsonTree]);

  const handleSubmit = useCallback(() => {
    const qFilter = {
      query: elasticSearchFormat(treeInternal, config),
    };
    setQueryFilter(qFilter);
    setSQLQuery(
      treeInternal ? QbUtils.sqlFormat(treeInternal, config) ?? '' : ''
    );
    handleTreeUpdate(treeInternal);
    setShowModal(false);
  }, [treeInternal, config, handleTreeUpdate]);

  const contextValues = useMemo(
    () => ({
      queryFilter,
      sqlQuery,
      onTreeUpdate: handleChange,
      toggleModal,
      treeInternal,
      config,
      searchIndex,
      onReset: handleReset,
      onResetAllFilters: handleResetAllFilters,
      onUpdateConfig: handleConfigUpdate,
    }),
    [
      queryFilter,
      sqlQuery,
      handleChange,
      toggleModal,
      treeInternal,
      config,
      searchIndex,
      handleReset,
      handleResetAllFilters,
      handleConfigUpdate,
    ]
  );

  return (
    <AdvancedSearchContext.Provider value={contextValues}>
      {loading ? <Loader /> : children}
      <AdvancedSearchModal
        visible={showModal}
        onCancel={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />
    </AdvancedSearchContext.Provider>
  );
};

export const useAdvanceSearch = () => useContext(AdvancedSearchContext);
