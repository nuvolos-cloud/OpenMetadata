/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_INVALID_FORMAT;

import java.util.ArrayList;
import java.util.List;
import org.passay.CharacterData;
import org.passay.CharacterRule;
import org.passay.EnglishCharacterData;
import org.passay.LengthRule;
import org.passay.PasswordData;
import org.passay.PasswordGenerator;
import org.passay.PasswordValidator;
import org.passay.Rule;
import org.passay.RuleResult;
import org.passay.WhitespaceRule;

public class PasswordUtil {

  private static final PasswordValidator VALIDATOR;

  static {
    List<Rule> rules = new ArrayList<>();
    // 8 and 16 characters
    rules.add(new LengthRule(8, 56));
    // No whitespace allowed
    rules.add(new WhitespaceRule());
    // At least one Upper-case character
    rules.add(new CharacterRule(EnglishCharacterData.UpperCase, 1));
    // At least one Lower-case character
    rules.add(new CharacterRule(EnglishCharacterData.LowerCase, 1));
    // Rule 3.c: At least one digit
    rules.add(new CharacterRule(EnglishCharacterData.Digit, 1));
    // Rule 3.d: At least one special character
    rules.add(new CharacterRule(EnglishCharacterData.Special, 1));
    VALIDATOR = new PasswordValidator(rules);
  }

  private PasswordUtil() {}

  public static void validatePassword(String pwd) {
    PasswordData password = new PasswordData(pwd);
    RuleResult result = VALIDATOR.validate(password);
    if (!result.isValid()) {
      throw new IllegalArgumentException(PASSWORD_INVALID_FORMAT);
    }
  }

  public static String generateRandomPassword() {
    PasswordGenerator gen = new PasswordGenerator();
    CharacterData lowerCaseChars = EnglishCharacterData.LowerCase;
    CharacterRule lowerCaseRule = new CharacterRule(lowerCaseChars);
    lowerCaseRule.setNumberOfCharacters(2);

    CharacterData upperCaseChars = EnglishCharacterData.UpperCase;
    CharacterRule upperCaseRule = new CharacterRule(upperCaseChars);
    upperCaseRule.setNumberOfCharacters(2);

    CharacterData digitChars = EnglishCharacterData.Digit;
    CharacterRule digitRule = new CharacterRule(digitChars);
    digitRule.setNumberOfCharacters(2);

    CharacterData specialChars =
        new CharacterData() {
          public String getErrorCode() {
            return "Invalid Special Char";
          }

          public String getCharacters() {
            return "!@#$%^&*()_+";
          }
        };
    CharacterRule splCharRule = new CharacterRule(specialChars);
    splCharRule.setNumberOfCharacters(2);

    return gen.generatePassword(8, splCharRule, lowerCaseRule, upperCaseRule, digitRule);
  }
}
