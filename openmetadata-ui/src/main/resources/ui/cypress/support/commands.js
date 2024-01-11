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
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import { interceptURL, verifyResponseStatusCode } from '../common/common';
import { BASE_URL, LOGIN } from '../constants/constants';

Cypress.Commands.add('loginByGoogleApi', () => {
  cy.log('Logging in to Google');
  cy.request({
    method: 'POST',
    url: 'https://www.googleapis.com/oauth2/v4/token',
    body: {
      grant_type: 'refresh_token',
      client_id: Cypress.env('googleClientId'),
      client_secret: Cypress.env('googleClientSecret'),
      refresh_token: Cypress.env('googleRefreshToken'),
    },
  }).then(({ body }) => {
    const { access_token, id_token } = body;

    cy.request({
      method: 'GET',
      url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      headers: { Authorization: `Bearer ${access_token}` },
    }).then(({ body }) => {
      cy.log(body);
      const userItem = {
        token: id_token,
        user: {
          googleId: body.sub,
          email: body.email,
          givenName: body.given_name,
          familyName: body.family_name,
          imageUrl: body.picture,
        },
      };

      window.localStorage.setItem('googleCypress', JSON.stringify(userItem));
      window.localStorage.setItem('oidcIdToken', id_token);
      cy.visit('/');
    });
  });
});

Cypress.Commands.add('goToHomePage', (doNotNavigate) => {
  interceptURL('GET', '/api/v1/users/loggedInUser?fields=*', 'userProfile');
  !doNotNavigate && cy.visit('/');

  verifyResponseStatusCode('@userProfile', 200);
});

Cypress.Commands.add('clickOnLogo', () => {
  cy.get('#openmetadata_logo > [data-testid="image"]').click();
});

const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/;
Cypress.on('uncaught:exception', (err) => {
  /* returning false here prevents Cypress from failing the test */
  if (resizeObserverLoopErrRe.test(err.message)) {
    return false;
  }
});

Cypress.Commands.add('storeSession', (username, password) => {
  /* 
  Reference docs for session https://docs.cypress.io/api/commands/session
  Its currently Experimental feature, but cypress is encouraging to use this feature
  as Cypress.Cookies.preserveOnce() and Cypress.Cookies.defaults() has been deprecated
  */

  cy.session([username, password], () => {
    cy.visit('/');
    cy.get('[id="email"]').should('be.visible').clear().type(username);
    cy.get('[id="password"]').should('be.visible').clear().type(password);
    interceptURL('POST', '/api/v1/users/login', 'login');
    cy.get('[data-testid="login"]').contains('Login').click();
    verifyResponseStatusCode('@login', 200);
    cy.url().should('not.eq', `${BASE_URL}/signin`);

    // Don't want to show any popup in the tests
    cy.setCookie(`STAR_OMD_USER_admin`, 'true');

    // Get version and set cookie to hide version banner
    cy.request({
      method: 'GET',
      url: `api/v1/system/version`,
    }).then((res) => {
      const version = res.body.version;
      const versionCookie = `VERSION_${version
        .split('-')[0]
        .replaceAll('.', '_')}`;

      cy.setCookie(versionCookie, 'true');
    });
  });
});

Cypress.Commands.add('login', () => {
  cy.storeSession(LOGIN.username, LOGIN.password);
  cy.goToHomePage();
});

Cypress.Commands.add('clickOutside', function () {
  return cy.get('body').click(0, 0); // 0,0 here are the x and y coordinates
});

Cypress.Commands.add('logout', () => {
  interceptURL('POST', '/api/v1/users/logout', 'logoutUser');
  cy.get('[data-testid="app-bar-item-logout"]').scrollIntoView().click();

  cy.get('[data-testid="confirm-logout"]').click();

  // verify the logout request
  verifyResponseStatusCode('@logoutUser', 200);

  cy.url().should('eq', `${BASE_URL}/signin`);
});
