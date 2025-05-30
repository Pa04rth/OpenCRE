import './commonRequirementEnumeration.scss';

import axios from 'axios';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { DocumentNode } from '../../components/DocumentNode';
import { ClearFilterButton, FilterButton } from '../../components/FilterButton/FilterButton';
import { LoadingAndErrorIndicator } from '../../components/LoadingAndErrorIndicator';
import { useEnvironment } from '../../hooks';
import { applyFilters, filterContext } from '../../hooks/applyFilters';
import { DataContext } from '../../providers/DataProvider';
import { Document } from '../../types';
import { groupLinksByType } from '../../utils';
import { getDocumentDisplayName, getDocumentTypeText, orderLinksByType } from '../../utils/document';

export const CommonRequirementEnumeration = () => {
  const { id } = useParams();
  const { apiUrl } = useEnvironment();
  const dataContext = useContext(DataContext);
  const selectedResources = dataContext ? dataContext.selectedResources : [];
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Object | null>(null);
  const [data, setData] = useState<Document | null>();

  useEffect(() => {
    setLoading(true);
    window.scrollTo(0, 0);

    axios
      .get(`${apiUrl}/id/${id}`)
      .then(function (response) {
        setError(null);
        setData(response?.data?.data);
      })
      .catch(function (axiosError) {
        if (axiosError.response.status === 404) {
          setError('CRE does not exist in the DB, please check your search parameters');
        } else {
          setError(axiosError.response);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const cre = data;
  let filteredCRE;
  if (cre != undefined) {
    filteredCRE = applyFilters(JSON.parse(JSON.stringify(cre))); // dirty deepcopy
  }
  let currentUrlParams = new URLSearchParams(window.location.search);
  let display: Document;
  display = currentUrlParams.get('applyFilters') === 'true' ? filteredCRE : cre;

  // Apply filtering based on selected resources
  if (display && selectedResources.length > 0) {
    console.log('Selected Resources:', selectedResources);
    display = {
      ...display,
      links: display.links
        ? display.links.filter((link) => selectedResources.includes(link.document.doctype))
        : [],
    };
    console.log('Filtered Display:', display);
  }

  const linksByType = useMemo(() => (display ? orderLinksByType(groupLinksByType(display)) : {}), [display]);
  return (
    <div className="cre-page">
      <LoadingAndErrorIndicator loading={loading} error={error} />
      {!loading && !error && display && (
        <>
          <h4 className="cre-page__heading">{display.name}</h4>
          <h5 className="cre-page__sub-heading">CRE: {display.id}</h5>
          <div className="cre-page__description">{display.description}</div>
          {display && display.hyperlink && (
            <>
              <span>Reference: </span>
              <a href={display?.hyperlink} target="_blank">
                {' '}
                {display.hyperlink}
              </a>
            </>
          )}

          {currentUrlParams.get('applyFilters') === 'true' ? (
            <div className="cre-page__filters">
              Filtering on:{' '}
              {currentUrlParams.getAll('filters').map((filter) => (
                <b key={filter}>{filter.replace('s:', '').replace('c:', '')}, </b>
              ))}
              <ClearFilterButton />
            </div>
          ) : (
            ''
          )}
          <div className="cre-page__links-container">
            {Object.keys(linksByType).length > 0 &&
              Object.entries(linksByType).map(([type, links]) => {
                const sortedResults = links.sort((a, b) =>
                  getDocumentDisplayName(a.document).localeCompare(getDocumentDisplayName(b.document))
                );
                let lastDocumentName = sortedResults[0].document.name;
                return (
                  <div className="cre-page__links" key={type}>
                    <div className="cre-page__links-eader">
                      <b>Which {getDocumentTypeText(type, links[0].document.doctype)}</b>:
                      {/* Risk of mixed doctype in here causing odd output */}
                    </div>
                    {sortedResults.map((link, i) => {
                      const temp = (
                        <div key={i} className="accordion ui fluid styled cre-page__links-container">
                          {lastDocumentName !== link.document.name && <span style={{ margin: '5px' }} />}
                          <DocumentNode node={link.document} linkType={type} />
                          <FilterButton document={link.document} />
                        </div>
                      );
                      lastDocumentName = link.document.name;
                      return temp;
                    })}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};
