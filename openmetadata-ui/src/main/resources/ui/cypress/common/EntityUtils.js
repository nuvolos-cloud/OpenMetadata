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

import {
  DATABASE_DETAILS,
  DATABASE_SERVICE_DETAILS,
  SCHEMA_DETAILS,
} from '../constants/EntityConstant';
import { uuid } from './common';

/**
 * create full hierarchy of database service (service > database > schema > tables)
 */
export const createEntityTable = ({
  service,
  database,
  schema,
  tables,
  token,
}) => {
  const createdEntityIds = {
    databaseId: undefined,
    databaseSchemaId: undefined,
  };

  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/databaseServices`,
    headers: { Authorization: `Bearer ${token}` },
    body: service,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });

  // Create Database
  cy.request({
    method: 'POST',
    url: `/api/v1/databases`,
    headers: { Authorization: `Bearer ${token}` },
    body: database,
  }).then((response) => {
    expect(response.status).to.eq(201);

    createdEntityIds.databaseId = response.body.id;
  });

  // Create Database Schema
  cy.request({
    method: 'POST',
    url: `/api/v1/databaseSchemas`,
    headers: { Authorization: `Bearer ${token}` },
    body: schema,
  }).then((response) => {
    expect(response.status).to.eq(201);

    createdEntityIds.databaseSchemaId = response.body.id;
  });

  tables.forEach((body) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/tables`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  return createdEntityIds;
};

/**
 * Create single level service like messaging, pipeline, mlmodel etc.
 */
export const createSingleLevelEntity = ({
  service,
  entity,
  serviceType,
  entityType,
  token,
}) => {
  // Create service
  cy.request({
    method: 'POST',
    url: `/api/v1/services/${serviceType}`,
    headers: { Authorization: `Bearer ${token}` },
    body: service,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });

  (Array.isArray(entity) ? entity : [entity]).forEach((body) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/${entityType}`,
      headers: { Authorization: `Bearer ${token}` },
      body,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });
};

/**
 * Delete full hierarchy of any service
 */
export const hardDeleteService = ({ serviceFqn, token, serviceType }) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/services/${serviceType}/name/${serviceFqn}?include=all`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/services/${serviceType}/${response.body.id}?hardDelete=true&recursive=true`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};

export const generateRandomTable = () => {
  const id = uuid();
  const name = `cypress-table-${id}`;

  const table = {
    name,
    description: `cypress-table-description-${id}`,
    displayName: name,
    columns: [
      {
        name: `cypress-column-${id}`,
        description: `cypress-column-description-${id}`,
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
      },
    ],
    databaseSchema: `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}.${SCHEMA_DETAILS.name}`,
  };

  return table;
};

/**
 * get Table by name and create query in the table
 */
export const createQueryByTableName = (token, table) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/tables/name/${table.databaseSchema}.${table.name}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/queries`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        query: 'SELECT * FROM SALES',
        description: 'this is query description',
        queryUsedIn: [
          {
            id: response.body.id,
            type: 'table',
          },
        ],
        duration: 6199,
        queryDate: 1700225667191,
        service: DATABASE_SERVICE_DETAILS.name,
      },
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });
};

/**
 * Create a new user
 */
export const createUserEntity = ({ token, user }) => {
  cy.request({
    method: 'POST',
    url: `/api/v1/users/signup`,
    headers: { Authorization: `Bearer ${token}` },
    body: user,
  }).then((response) => {
    user.id = response.body.id;
  });
};

/**
 * Delete a user by id
 */
export const deleteUserEntity = ({ token, id }) => {
  cy.request({
    method: 'DELETE',
    url: `/api/v1/users/${id}?hardDelete=true&recursive=false`,
    headers: { Authorization: `Bearer ${token}` },
  });
};

/**
 * Delete any entity by id
 */
export const deleteEntityById = ({ entityType, token, entityFqn }) => {
  cy.request({
    method: 'GET',
    url: `/api/v1/${entityType}/name/${entityFqn}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'DELETE',
      url: `/api/v1/${entityType}/${response.body.id}?hardDelete=true&recursive=true`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
};
