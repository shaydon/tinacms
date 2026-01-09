import { Collection, TinaSchema, resolveForm } from '@tinacms/schema-tools';
import type { Template } from '@tinacms/schema-tools';
import {
  BillingWarning,
  Form,
  FormBuilder,
  FormStatus,
  TinaForm,
} from '@tinacms/toolkit';
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { TinaCMS } from '@tinacms/toolkit';
import { FormBreadcrumbs } from '@toolkit/react-sidebar/components/sidebar-body';
import { TinaAdminApi } from '../api';
import { ErrorDialog } from '../components/ErrorDialog';
import GetCMS from '../components/GetCMS';
import GetCollection from '../components/GetCollection';
import { PageWrapper } from '../components/Page';
import { useCollectionFolder } from './utils';
import { augmentFormConfigForCreation } from '@toolkit/form-builder/document-creation';

const createDocument = async (
  cms: TinaCMS,
  collection: Collection,
  template: { name: string },
  mutationInfo: { includeCollection: boolean; includeTemplate: boolean },
  folder: string,
  values: any
) => {
  const api = new TinaAdminApi(cms);
  const { filename, ...leftover } = values;

  if (typeof filename !== 'string') {
    throw new Error('Filename must be a string');
  }

  // Append the folder if it exists and the filename does not start with a slash
  const appendFolder =
    folder && !filename.startsWith('/') ? `/${folder}/` : '/';
  const relativePath = `${appendFolder}${filename}.${collection.format}`;

  const params = api.schema.transformPayload(collection.name, {
    _collection: collection.name,
    ...(template && { _template: template.name }),
    ...leftover,
  });

  if (await api.isAuthenticated()) {
    await api.createDocument(collection, relativePath, params);
  } else {
    const authMessage = `CreateDocument failed: User is no longer authenticated; please login and try again.`;
    cms.alerts.error(authMessage);
    console.error(authMessage);
    return false;
  }
};

const CollectionCreatePage = () => {
  const folder = useCollectionFolder();
  const { collectionName, templateName } = useParams();

  return (
    <GetCMS>
      {(cms: TinaCMS) => (
        <GetCollection
          cms={cms}
          collectionName={collectionName}
          folder={folder}
          includeDocuments={false}
        >
          {(collection) => {
            const mutationInfo = {
              includeCollection: true,
              includeTemplate: !!collection.templates,
            };

            return (
              <RenderForm
                cms={cms}
                collection={collection}
                templateName={templateName}
                mutationInfo={mutationInfo}
                folder={folder}
              />
            );
          }}
        </GetCollection>
      )}
    </GetCMS>
  );
};

export const RenderForm = ({
  cms,
  collection,
  folder,
  templateName,
  mutationInfo,
  customDefaults,
}: {
  cms: TinaCMS;
  collection: Collection;
  folder;
  templateName;
  mutationInfo;
  customDefaults?: any;
}) => {
  const navigate = useNavigate();
  const [formIsPristine, setFormIsPristine] = useState(true);
  const schema: TinaSchema | undefined = cms.api.tina.schema;

  // the schema is being passed in from the frontend so we can use that
  const schemaCollection = schema.getCollection(collection.name);
  const template: Template<true> = schema.getTemplateForData({
    collection: schemaCollection,
    data: { _template: templateName },
  }) as Template<true>;

  const formInfo = resolveForm({
    collection: schemaCollection,
    basename: schemaCollection.name,
    schema: schema,
    template,
  });

  const defaultItem =
    customDefaults ||
    // @ts-ignore internal types aren't up to date
    template.ui?.defaultItem ||
    // @ts-ignore
    template?.defaultItem ||
    {};

  const form = useMemo(() => {
    const folderName = folder.fullyQualifiedName ? folder.name : '';
    return new Form(
      augmentFormConfigForCreation(
        schema,
        collection,
        schemaCollection,
        template,
        folderName,
        () => form,
        {
          initialValues:
            typeof defaultItem === 'function'
              ? { ...defaultItem(), _template: templateName }
              : { ...defaultItem, _template: templateName },
          id:
            schemaCollection.path +
            folderName +
            `/new-post.${schemaCollection.format || 'md'}`,
          label: 'form',
          fields: formInfo.fields,
          onSubmit: async (values) => {
            try {
              const folderName = folder.fullyQualifiedName ? folder.name : '';
              await createDocument(
                cms,
                collection,
                template,
                mutationInfo,
                folderName,
                values
              );
              cms.alerts.success('Document created!');
              setTimeout(() => {
                navigate(
                  `/collections/${collection.name}${
                    folder.fullyQualifiedName
                      ? `/${folder.fullyQualifiedName}`
                      : ''
                  }`
                );
              }, 10);
            } catch (error) {
              console.error(error);
              const defaultErrorText =
                'There was a problem saving your document.';
              if (error.message.includes('already exists')) {
                cms.alerts.error(
                  `${defaultErrorText} The "Filename" is already used for another document, please modify it.`
                );
              } else {
                cms.alerts.error(() =>
                  ErrorDialog({
                    title: defaultErrorText,
                    message: 'Tina caught an error while creating the page',
                    error,
                  })
                );
              }
              throw new Error(
                `[${error.name}] CreateDocument failed: ${error.message}`
              );
            }
          },
        }
      )
    );
  }, [cms, collection, mutationInfo]);

  React.useEffect(() => {
    cms.dispatch({ type: 'forms:add', value: form });
    cms.dispatch({ type: 'forms:set-active-form-id', value: form.id });
    return () => {
      cms.dispatch({ type: 'forms:remove', value: form.id });
      cms.dispatch({ type: 'forms:set-active-form-id', value: null });
    };
  }, [JSON.stringify(formInfo.fields)]);
  if (!cms.state.activeFormId) {
    return null;
  }
  const activeForm = cms.state.forms.find(
    ({ tinaForm }) => tinaForm.id === form.id
  );

  return (
    <PageWrapper headerClassName='bg-white'>
      <>
        <div
          className={`py-4 px-6 border-b border-gray-200 bg-white w-full grow-0 shrink basis-0 flex justify-center`}
        >
          <div className='w-full flex gap-1.5 justify-between items-center'>
            <FormBreadcrumbs
              className='w-[calc(100%-3rem)]'
              rootBreadcrumbName='Create New'
            />
            <FormStatus pristine={formIsPristine} />
          </div>
        </div>

        {activeForm && (
          <FormBuilder form={activeForm} onPristineChange={setFormIsPristine} />
        )}
      </>
    </PageWrapper>
  );
};

export default CollectionCreatePage;
