import axios from 'axios';
import Cookies from 'js-cookie';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from 'react-query';

import { TWO_DAYS_MILLISECONDS } from '../const';
import { useEnvironment } from '../hooks/useEnvironment';
import { Document, TreeDocument } from '../types';
import { getLocalStorageObject, setLocalStorageObject } from '../utils';
import { getDocumentDisplayName, getInternalUrl } from '../utils/document';

const DATA_STORE_KEY = 'data-store';
const DATA_TREE_KEY = 'record-tree';

type DataContextValues = {
  dataLoading: boolean;
  dataStore: Record<string, TreeDocument>;
  dataTree: TreeDocument[];
  getStoreKey: (doc: Document) => string;
  setSelectedResources: (resources: string[]) => void;
  selectedResources: string[];
};

export const DataContext = createContext<DataContextValues | null>(null);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const { apiUrl } = useEnvironment();
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [dataStore, setDataStore] = useState<Record<string, TreeDocument>>(
    getLocalStorageObject(DATA_STORE_KEY) || {}
  );
  const [dataTree, setDataTree] = useState<TreeDocument[]>(getLocalStorageObject(DATA_TREE_KEY) || []);
  const [selectedResources, setSelectedResources] = useState<string[]>(
    JSON.parse(Cookies.get('selectedResources') || '[]')
  );

  const getStoreKey = (doc: Document): string => {
    if (doc.doctype === 'CRE') return doc.id;
    if (doc.doctype === 'Standard') return doc.name;
    return `${doc.name}-${doc.sectionID}-${doc.section}`;
  };

  const buildTree = (doc: Document, keyPath: string[] = []): TreeDocument => {
    const selfKey = getStoreKey(doc);
    keyPath.push(selfKey);

    const storedDoc = structuredClone(dataStore[selfKey]);

    const initialLinks = storedDoc.links;
    let creLinks = initialLinks.filter(
      (x) =>
        !!x.document && !keyPath.includes(getStoreKey(x.document)) && getStoreKey(x.document) in dataStore
    );

    creLinks = creLinks.filter((x) => x.ltype === 'Contains');

    //continue traversing the tree
    creLinks = creLinks.map((x) => ({ ltype: x.ltype, document: buildTree(x.document, keyPath) }));
    storedDoc.links = [...creLinks];

    //attach Standards to the CREs
    const standards = initialLinks.filter(
      (link) =>
        link.document && link.document.doctype === 'Standard' && !keyPath.includes(getStoreKey(link.document))
    );
    storedDoc.links = [...creLinks, ...standards];

    return storedDoc;
  };

  const getTreeQuery = useQuery(
    'root_cres',
    async () => {
      if (!dataTree.length && Object.keys(dataStore).length) {
        try {
          const result = await axios.get(`${apiUrl}/root_cres`);
          const treeData = result.data.data.map((x) => buildTree(x));
          setLocalStorageObject(DATA_TREE_KEY, treeData, TWO_DAYS_MILLISECONDS);
          setDataTree(treeData);
        } catch (error) {
          console.error(error);
        }
      }
    },
    {
      retry: false,
      enabled: false,
    }
  );

  const getStoreQuery = useQuery(
    'all_cres',
    async () => {
      if (!Object.keys(dataStore).length) {
        try {
          const result = await axios.get(`${apiUrl}/all_cres?page=1&per_page=1000`);
          let data = result.data.data;
          let store = {};

          if (data.length) {
            data.forEach((x) => {
              store[getStoreKey(x)] = {
                links: x.links,
                displayName: getDocumentDisplayName(x),
                url: getInternalUrl(x),
                ...x,
              };
            });

            setLocalStorageObject(DATA_STORE_KEY, store, TWO_DAYS_MILLISECONDS);
            setDataStore(store);
            console.log('retrieved all cres');
          }
        } catch (error) {
          console.error('Could not retrieve CREs error:');
          console.error(error);
        }
      }
    },
    {
      retry: false,
      enabled: false,
    }
  );

  useEffect(() => {
    setDataLoading(getStoreQuery.isLoading || getTreeQuery.isLoading);
  }, [getStoreQuery.isLoading, getTreeQuery.isLoading]);

  useEffect(() => {
    getStoreQuery.refetch();
  }, [dataTree]);

  useEffect(() => {
    getTreeQuery.refetch();
  }, [dataStore, setDataStore]);

  useEffect(() => {
    if (selectedResources.length > 0) {
      const filteredDataStore = Object.keys(dataStore)
        .filter((key) => selectedResources.includes(dataStore[key].doctype))
        .reduce((obj, key) => {
          obj[key] = dataStore[key];
          return obj;
        }, {});
      setDataStore(filteredDataStore);
    }
  }, [selectedResources]);

  return (
    <DataContext.Provider
      value={{
        dataLoading,
        dataStore,
        dataTree,
        getStoreKey,
        setSelectedResources,
        selectedResources,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useDataStore = () => {
  const dataContext = useContext(DataContext);

  if (!dataContext) {
    throw new Error('useDataStore must be used within a DataProvider');
  }
  return dataContext;
};
