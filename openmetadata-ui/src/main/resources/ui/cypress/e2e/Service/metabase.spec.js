/*
 *  Copyright 2022 Collate.
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

import {
  checkServiceFieldSectionHighlighting,
  deleteCreatedService,
  goToAddNewServicePage,
  testServiceCreationAndIngestion,
  updateDescriptionForIngestedTables,
  uuid,
} from '../../common/common';
import { API_SERVICE, SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Metabase';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'jaffle_shop dashboard';
const description = `This is ${serviceName} description`;

describe('Metabase Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Dashboard);

    // Select Dashboard services
    cy.get('[data-testid="service-category"]').should('be.visible').click();
    cy.get('.ant-select-item-option-content')
      .contains('Dashboard Services')
      .click();

    const connectionInput = () => {
      cy.get('#root\\/username')
        .scrollIntoView()
        .type(Cypress.env('metabaseUsername'));
      checkServiceFieldSectionHighlighting('username');
      cy.get('#root\\/password')
        .scrollIntoView()
        .type(Cypress.env('metabasePassword'));
      checkServiceFieldSectionHighlighting('password');
      cy.get('#root\\/hostPort')
        .scrollIntoView()
        .type(Cypress.env('metabaseHostPort'));
      checkServiceFieldSectionHighlighting('hostPort');
    };

    const addIngestionInput = () => {
      cy.get('#root\\/dashboardFilterPattern\\/includes')
        .scrollIntoView()

        .type(`${tableName}{enter}`);
    };

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName,
      type: 'dashboard',
      serviceCategory: SERVICE_TYPE.Dashboard,
    });
  });

  it.skip('Update table description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      serviceName,
      tableName,
      description,
      SERVICE_TYPE.Dashboard,
      'dashboards'
    );
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Dashboard,
      serviceName,
      API_SERVICE.dashboardServices
    );
  });
});
