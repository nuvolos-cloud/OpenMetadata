#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validator for column values to be not null test case
"""

from typing import Optional

from metadata.data_quality.validations.column.base.columnValuesToBeNotNull import (
    BaseColumnValuesToBeNotNullValidator,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.sqa_like_column import SQALikeColumn


class ColumnValuesToBeNotNullValidator(
    BaseColumnValuesToBeNotNullValidator, PandasValidatorMixin
):
    """Validator for column values to be not null test case"""

    def _get_column_name(self) -> SQALikeColumn:
        """Get column name from the test case entity link

        Returns:
            SQALikeColumn: column
        """
        return self.get_column_name(
            self.test_case.entityLink.__root__,
            self.runner,
        )

    def _run_results(self, metric: Metrics, column: SQALikeColumn) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_dataframe_results(self.runner, metric, column)

    def compute_row_count(self, column: SQALikeColumn):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)
