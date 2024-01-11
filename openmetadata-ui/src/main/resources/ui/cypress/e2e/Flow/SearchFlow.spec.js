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

// The spec is related to advance search feature

import {
  advanceSearchPreRequests,
  ADVANCE_SEARCH_DATABASE_SERVICE,
  checkAddGroupWithOperator,
  checkAddRuleWithOperator,
  checkmustPaths,
  checkmust_notPaths,
  CONDITIONS_MUST,
  CONDITIONS_MUST_NOT,
  FIELDS,
  OPERATOR,
} from '../../common/advancedSearch';
import { hardDeleteService } from '../../common/EntityUtils';
import { USER_CREDENTIALS } from '../../constants/SearchIndexDetails.constants';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

describe('Advance search', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      advanceSearchPreRequests(token);
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: ADVANCE_SEARCH_DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${USER_CREDENTIALS.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  describe('Single filed search', () => {
    beforeEach(() => {
      cy.login();
    });

    Object.values(FIELDS).forEach((field) => {
      it(`Verify advance search results for ${field.name} field and all condition`, () => {
        Object.values(CONDITIONS_MUST).forEach((condition) => {
          checkmustPaths(
            condition.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            0,
            field.responseValueFirstGroup
          );
        });

        Object.values(CONDITIONS_MUST_NOT).forEach((condition) => {
          checkmust_notPaths(
            condition.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            0,
            field.responseValueFirstGroup
          );
        });
      });
    });

    after(() => {
      cy.logout();
      Cypress.session.clearAllSavedSessions();
    });
  });

  describe('Group search', () => {
    beforeEach(() => {
      cy.login();
    });

    Object.values(OPERATOR).forEach((operator) => {
      it(`Verify Add group functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.equalTo.name} and ${CONDITIONS_MUST_NOT.notEqualTo.name} `, () => {
        Object.values(FIELDS).forEach((field) => {
          let val = field.searchCriteriaSecondGroup;
          if (field.owner) {
            val = field.responseValueSecondGroup;
          }
          checkAddGroupWithOperator(
            CONDITIONS_MUST.equalTo.name,
            CONDITIONS_MUST_NOT.notEqualTo.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            Cypress._.toLower(field.searchCriteriaSecondGroup),
            0,
            1,
            operator.index,
            CONDITIONS_MUST.equalTo.filter,
            CONDITIONS_MUST_NOT.notEqualTo.filter,
            field.responseValueFirstGroup,
            val
          );
        });
      });

      it(`Verify Add group functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.anyIn.name} and ${CONDITIONS_MUST_NOT.notIn.name} `, () => {
        Object.values(FIELDS).forEach((field) => {
          let val = field.searchCriteriaSecondGroup;
          if (field.owner) {
            val = field.responseValueSecondGroup;
          }
          checkAddGroupWithOperator(
            CONDITIONS_MUST.anyIn.name,
            CONDITIONS_MUST_NOT.notIn.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            Cypress._.toLower(field.searchCriteriaSecondGroup),
            0,
            1,
            operator.index,
            CONDITIONS_MUST.anyIn.filter,
            CONDITIONS_MUST_NOT.notIn.filter,
            field.responseValueFirstGroup,
            val
          );
        });
      });

      it(`Verify Add group functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.contains.name} and ${CONDITIONS_MUST_NOT.notContains.name} `, () => {
        Object.values(FIELDS).forEach((field) => {
          let val = field.searchCriteriaSecondGroup;

          checkAddGroupWithOperator(
            CONDITIONS_MUST.contains.name,
            CONDITIONS_MUST_NOT.notContains.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            Cypress._.toLower(field.searchCriteriaSecondGroup),
            0,
            1,
            operator.index,
            CONDITIONS_MUST.contains.filter,
            CONDITIONS_MUST_NOT.notContains.filter,
            field.responseValueFirstGroup,
            val
          );
        });
      });
    });

    after(() => {
      cy.logout();
      Cypress.session.clearAllSavedSessions();
    });
  });

  describe.skip('Search with additional rule', () => {
    beforeEach(() => {
      cy.login();
    });

    Object.values(OPERATOR).forEach((operator) => {
      it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.equalTo.name} and ${CONDITIONS_MUST_NOT.notEqualTo.name} `, () => {
        Object.values(FIELDS).forEach((field) => {
          let val = field.searchCriteriaSecondGroup;
          if (field.owner) {
            val = field.responseValueSecondGroup;
          }
          checkAddRuleWithOperator(
            CONDITIONS_MUST.equalTo.name,
            CONDITIONS_MUST_NOT.notEqualTo.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            Cypress._.toLower(field.searchCriteriaSecondGroup),
            0,
            1,
            operator.index,
            CONDITIONS_MUST.equalTo.filter,
            CONDITIONS_MUST_NOT.notEqualTo.filter,
            field.responseValueFirstGroup,
            Cypress._.toLower(val)
          );
        });
      });

      it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.anyIn.name} and ${CONDITIONS_MUST_NOT.notIn.name} `, () => {
        Object.values(FIELDS).forEach((field) => {
          let val = field.searchCriteriaSecondGroup;
          if (field.owner) {
            val = field.responseValueSecondGroup;
          }
          checkAddRuleWithOperator(
            CONDITIONS_MUST.anyIn.name,
            CONDITIONS_MUST_NOT.notIn.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            Cypress._.toLower(field.searchCriteriaSecondGroup),
            0,
            1,
            operator.index,
            CONDITIONS_MUST.anyIn.filter,
            CONDITIONS_MUST_NOT.notIn.filter,
            field.responseValueFirstGroup,
            Cypress._.toLower(val)
          );
        });
      });

      it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.contains.name} and ${CONDITIONS_MUST_NOT.notContains.name} `, () => {
        Object.values(FIELDS).forEach((field) => {
          let val = field.searchCriteriaSecondGroup;
          checkAddRuleWithOperator(
            CONDITIONS_MUST.contains.name,
            CONDITIONS_MUST_NOT.notContains.name,
            field.testid,
            Cypress._.toLower(field.searchCriteriaFirstGroup),
            Cypress._.toLower(field.searchCriteriaSecondGroup),
            0,
            1,
            operator.index,
            CONDITIONS_MUST.contains.filter,
            CONDITIONS_MUST_NOT.notContains.filter,
            field.responseValueFirstGroup,
            Cypress._.toLower(val)
          );
        });
      });
    });

    after(() => {
      cy.logout();
      Cypress.session.clearAllSavedSessions();
    });
  });
});
