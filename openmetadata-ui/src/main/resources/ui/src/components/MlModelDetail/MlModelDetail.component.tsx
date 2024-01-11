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

import { Col, Row, Table, Tabs, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import { getMlModelDetailsPath } from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { MlHyperParameter } from '../../generated/api/data/createMlModel';
import { Tag } from '../../generated/entity/classification/tag';
import { Mlmodel, MlStore } from '../../generated/entity/data/mlmodel';
import { ThreadType } from '../../generated/entity/feed/thread';
import { TagLabel } from '../../generated/type/schema';
import { restoreMlmodel } from '../../rest/mlModelAPI';
import { getEmptyPlaceholder, getFeedCounts } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { useAuthContext } from '../Auth/AuthProviders/AuthProvider';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import EntityRightPanel from '../Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../Lineage/Lineage.component';
import LineageProvider from '../LineageProvider/LineageProvider';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { MlModelDetailProp } from './MlModelDetail.interface';
import MlModelFeaturesList from './MlModelFeaturesList';

const MlModelDetail: FC<MlModelDetailProp> = ({
  updateMlModelDetailsState,
  mlModelDetail,
  fetchMlModel,
  followMlModelHandler,
  unFollowMlModelHandler,
  descriptionUpdateHandler,
  settingsUpdateHandler,
  updateMlModelFeatures,
  onExtensionUpdate,
  createThread,
  onUpdateVote,
  versionHandler,
  tagUpdateHandler,
  handleToggleDelete,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const history = useHistory();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { fqn: mlModelFqn, tab: activeTab } =
    useParams<{ tab: EntityTabs; fqn: string }>();

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);

  const [mlModelPermissions, setMlModelPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [threadLink, setThreadLink] = useState<string>('');

  const { getEntityPermission } = usePermissionProvider();

  const decodedMlModelFqn = useMemo(
    () => getDecodedFqn(mlModelFqn),
    [mlModelFqn]
  );

  const mlModelName = useMemo(
    () => getEntityName(mlModelDetail),
    [mlModelDetail]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.ML_MODEL,
        mlModelDetail.id
      );
      setMlModelPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  }, [mlModelDetail.id, getEntityPermission, setMlModelPermissions]);

  useEffect(() => {
    if (mlModelDetail.id) {
      fetchResourcePermission();
    }
  }, [mlModelDetail.id]);

  const { mlModelTags, isFollowing, tier, deleted } = useMemo(() => {
    return {
      ...mlModelDetail,
      tier: getTierTags(mlModelDetail.tags ?? []),
      mlModelTags: getTagsWithoutTier(mlModelDetail.tags ?? []),
      entityName: mlModelName,
      isFollowing: mlModelDetail.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [mlModelDetail, mlModelName]);

  const fetchEntityFeedCount = () => {
    getFeedCounts(EntityType.MLMODEL, decodedMlModelFqn, setFeedCount);
  };

  useEffect(() => {
    if (mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic) {
      fetchEntityFeedCount();
    }
  }, [mlModelPermissions, decodedMlModelFqn]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getMlModelDetailsPath(decodedMlModelFqn, activeKey));
    }
  };

  const followMlModel = async () => {
    if (isFollowing) {
      await unFollowMlModelHandler();
    } else {
      await followMlModelHandler();
    }
  };

  const onDescriptionEdit = () => setIsEdit(true);

  const onCancel = () => setIsEdit(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (mlModelDetail.description !== updatedHTML) {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        description: updatedHTML,
      };
      await descriptionUpdateHandler(updatedMlModelDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwner?: Mlmodel['owner']) => {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        owner: newOwner
          ? {
              ...mlModelDetail.owner,
              ...newOwner,
            }
          : undefined,
      };
      await settingsUpdateHandler(updatedMlModelDetails);
    },
    [mlModelDetail, mlModelDetail.owner]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(mlModelDetail?.tags ?? [], newTier);
    const updatedMlModelDetails = {
      ...mlModelDetail,
      tags: tierTag,
    };

    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedMlModelDetails = {
      ...mlModelDetail,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleRestoreMlmodel = async () => {
    try {
      const { version: newVersion } = await restoreMlmodel(mlModelDetail.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.ml-model'),
        }),
        // Autoclose timer
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  };

  const onFeaturesUpdate = async (features: Mlmodel['mlFeatures']) => {
    await updateMlModelFeatures({ ...mlModelDetail, mlFeatures: features });
  };

  const handleThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const handleThreadPanelClose = () => {
    setThreadLink('');
  };

  const getMlHyperParametersColumn: ColumnsType<MlHyperParameter> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
      },
    ],
    []
  );

  const mlModelStoreColumn = useMemo(() => {
    const column: ColumnsType<MlStore> = [
      {
        title: t('label.storage'),
        dataIndex: 'storage',
        key: 'storage',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
      {
        title: t('label.image-repository'),
        dataIndex: 'imageRepository',
        key: 'imageRepository',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
    ];

    return column;
  }, []);

  const getMlHyperParameters = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>
          {t('label.hyper-parameter-plural')}{' '}
        </Typography.Title>
        {isEmpty(mlModelDetail.mlHyperParameters) ? (
          getEmptyPlaceholder()
        ) : (
          <Table
            bordered
            columns={getMlHyperParametersColumn}
            data-testid="hyperparameters-table"
            dataSource={mlModelDetail.mlHyperParameters}
            pagination={false}
            rowKey="name"
            size="small"
          />
        )}
      </>
    );
  }, [mlModelDetail, getMlHyperParametersColumn]);

  const getMlModelStore = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>{t('label.model-store')}</Typography.Title>
        {mlModelDetail.mlStore ? (
          <Table
            bordered
            columns={mlModelStoreColumn}
            data-testid="model-store-table"
            dataSource={[mlModelDetail.mlStore]}
            id="model-store-table"
            pagination={false}
            rowKey="name"
            size="small"
          />
        ) : (
          getEmptyPlaceholder()
        )}
      </>
    );
  }, [mlModelDetail, mlModelStoreColumn]);

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && mlModelDetail) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedMlModel = { ...mlModelDetail, tags: updatedTags };
      await tagUpdateHandler(updatedMlModel);
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const {
    editTagsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (mlModelPermissions.EditTags || mlModelPermissions.EditAll) && !deleted,
      editDescriptionPermission:
        (mlModelPermissions.EditDescription || mlModelPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (mlModelPermissions.EditAll || mlModelPermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (mlModelPermissions.EditAll || mlModelPermissions.EditLineage) &&
        !deleted,
      viewAllPermission: mlModelPermissions.ViewAll,
    }),
    [mlModelPermissions, deleted]
  );

  const tabs = useMemo(
    () => [
      {
        name: t('label.feature-plural'),
        label: (
          <TabsLabel
            id={EntityTabs.FEATURES}
            name={t('label.feature-plural')}
          />
        ),
        key: EntityTabs.FEATURES,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <div className="d-flex flex-col gap-4">
                <DescriptionV1
                  description={mlModelDetail.description}
                  entityFqn={decodedMlModelFqn}
                  entityName={mlModelName}
                  entityType={EntityType.MLMODEL}
                  hasEditAccess={editDescriptionPermission}
                  isEdit={isEdit}
                  owner={mlModelDetail.owner}
                  showActions={!deleted}
                  onCancel={onCancel}
                  onDescriptionEdit={onDescriptionEdit}
                  onDescriptionUpdate={onDescriptionUpdate}
                  onThreadLinkSelect={handleThreadLinkSelect}
                />
                <MlModelFeaturesList
                  entityFqn={decodedMlModelFqn}
                  handleFeaturesUpdate={onFeaturesUpdate}
                  isDeleted={mlModelDetail.deleted}
                  mlFeatures={mlModelDetail.mlFeatures}
                  permissions={mlModelPermissions}
                  onThreadLinkSelect={handleThreadLinkSelect}
                />
              </div>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <EntityRightPanel
                dataProducts={mlModelDetail?.dataProducts ?? []}
                domain={mlModelDetail?.domain}
                editTagPermission={editTagsPermission}
                entityFQN={decodedMlModelFqn}
                entityId={mlModelDetail.id}
                entityType={EntityType.MLMODEL}
                selectedTags={mlModelTags}
                onTagSelectionChange={handleTagSelection}
                onThreadLinkSelect={handleThreadLinkSelect}
              />
            </Col>
          </Row>
        ),
      },
      {
        label: (
          <TabsLabel
            count={feedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            entityType={EntityType.MLMODEL}
            fqn={mlModelDetail?.fullyQualifiedName ?? ''}
            onFeedUpdate={fetchEntityFeedCount}
            onUpdateEntityDetails={fetchMlModel}
          />
        ),
      },
      {
        label: (
          <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
        ),
        key: EntityTabs.DETAILS,
        children: (
          <Row className="p-md" gutter={[16, 16]}>
            <Col span={12}>{getMlHyperParameters}</Col>
            <Col span={12}>{getMlModelStore}</Col>
          </Row>
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <LineageProvider>
            <Lineage
              deleted={deleted}
              entity={mlModelDetail as SourceType}
              entityType={EntityType.MLMODEL}
              hasEditAccess={editLineagePermission}
            />
          </LineageProvider>
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
        children: (
          <CustomPropertyTable
            entityType={EntityType.MLMODEL}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
          />
        ),
      },
    ],
    [
      feedCount,
      activeTab,
      mlModelDetail,
      mlModelName,
      mlModelPermissions,
      isEdit,
      getMlHyperParameters,
      getMlModelStore,
      onCancel,
      onExtensionUpdate,
      onFeaturesUpdate,
      handleThreadLinkSelect,
      onDescriptionUpdate,
      onDescriptionEdit,
      getEntityFieldThreadCounts,
      deleted,
      editTagsPermission,
      editDescriptionPermission,
      editCustomAttributePermission,
      editLineagePermission,
      viewAllPermission,
    ]
  );

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.ml-model'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateMlModelDetailsState}
            dataAsset={mlModelDetail}
            entityType={EntityType.MLMODEL}
            permissions={mlModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followMlModel}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreMlmodel}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab ?? EntityTabs.FEATURES}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>
      </Row>

      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateFeed}
          onCancel={handleThreadPanelClose}
        />
      ) : null}
    </PageLayoutV1>
  );
};

export default withActivityFeed<MlModelDetailProp>(MlModelDetail);
