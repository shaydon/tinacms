import {
  TinaSchema,
  Collection,
  type Template,
  normalizePath,
} from '@tinacms/schema-tools';
import { wrapFieldsWithMeta } from '@toolkit/fields';
import { type FormOptions, Form, Field, AnyField } from '@toolkit/forms';
import React from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';

const FilenameInput = (props) => {
  const [filenameTouched, setFilenameTouched] = React.useState(false);

  return (
    <div
      className='group relative block cursor-pointer'
      onClick={() => {
        setFilenameTouched(true);
      }}
    >
      <input
        type='text'
        className={`shadow-inner focus:shadow-outline focus:border-blue-500 focus:outline-none block text-base pr-3 truncate py-2 w-full border transition-all ease-out duration-150 focus:text-gray-900 rounded ${
          props.readonly || !filenameTouched
            ? 'bg-gray-50 text-gray-300  border-gray-150 pointer-events-none pl-8 group-hover:bg-white group-hover:text-gray-600  group-hover:border-gray-200'
            : 'bg-white text-gray-600  border-gray-200 pl-3'
        }`}
        {...props}
        disabled={props.readonly || !filenameTouched}
      />
      <FaLock
        className={`text-gray-400 absolute top-1/2 left-2 -translate-y-1/2 pointer-events-none h-5 w-auto transition-opacity duration-150 ease-out ${
          !filenameTouched && !props.readonly
            ? 'opacity-20 group-hover:opacity-0 group-active:opacity-0'
            : 'opacity-0'
        }`}
      />
      <FaUnlock
        className={`text-blue-500 absolute top-1/2 left-2 -translate-y-1/2 pointer-events-none h-5 w-auto transition-opacity duration-150 ease-out ${
          !filenameTouched && !props.readonly
            ? 'opacity-0 group-hover:opacity-80 group-active:opacity-80'
            : 'opacity-0'
        }`}
      />
    </div>
  );
};

export const augmentFormConfigForCreation = (
  schema: TinaSchema,
  collection: Collection,
  schemaCollection: Collection<true>,
  template: Template<true>,
  folderName: string,
  getForm: () => Form,
  options: FormOptions<any>
): FormOptions<any> => {
  let slugFunction = schemaCollection.ui?.filename?.slugify;

  if (!slugFunction) {
    const titleField = template?.fields.find(
      (x) => x.required && x.type === 'string' && x.isTitle
    )?.name;
    // If the collection does not a slugify function and is has a title field, use the default slugify function
    if (titleField) {
      // default slugify function strips out all non-alphanumeric characters
      slugFunction = (values: unknown) =>
        values[titleField]?.replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    }
  }

  const filenameField = {
    name: 'filename',
    label: 'Filename',
    component: slugFunction
      ? wrapFieldsWithMeta(({ field, input, meta }) => {
          return (
            <FilenameInput
              readOnly={schemaCollection?.ui?.filename?.readonly}
              {...input}
            />
          );
        })
      : 'text',
    disabled: schemaCollection?.ui?.filename?.readonly,
    description: collection.ui?.filename?.description ? (
      <span
        dangerouslySetInnerHTML={{
          __html: collection.ui.filename.description,
        }}
      />
    ) : (
      <span>
        A unique filename for the content.
        <br />
        Examples: <code>My_Document</code>, <code>My_Document.en</code>,{' '}
        <code>sub-folder/My_Document</code>
      </span>
    ),
    placeholder: 'My_Document',
    validate: (value, allValues, meta) => {
      if (!value) {
        if (meta.dirty) {
          return 'Required';
        }
        return true;
      }

      const isValid = /[\.\-_\/a-zA-Z0-9]*$/.test(value);
      if (value && !isValid) {
        return 'Must contain only a-z, A-Z, 0-9, -, _, ., or /.';
      }
      // check if the filename is allowed by the collection.
      if (schemaCollection.match?.exclude || schemaCollection.match?.include) {
        const filePath = `${normalizePath(schemaCollection.path)}/${value}.${schemaCollection.format || 'md'}`;
        const match = schema?.matchFiles({
          files: [filePath],
          collection: schemaCollection,
        });
        if (match?.length === 0) {
          return `The filename "${value}" is not allowed for this collection.`;
        }
      }
    },
  };

  return {
    ...options,
    crudType: 'create',
    extraSubscribeValues: { active: true, submitting: true, touched: true },
    onChange: (values) => {
      const form = getForm();
      if (options.onChange) {
        options.onChange(values);
      }
      if (!values?.submitting) {
        const filename: string = values?.values?.filename;

        // If the filename starts with "/" then it is an absolute path and we should not append the folder name
        const appendFolder =
          folderName && !filename?.startsWith('/') ? `/${folderName}/` : '/';

        // keeps the forms relative path in sync with the filename
        form.path =
          schemaCollection.path +
          appendFolder +
          `${filename}.${schemaCollection.format || 'md'}`;
        console.log('CREATE CONFIG', {
          filename: filename,
          folderName: folderName,
          path: form.path,
          relativePath: form.relativePath,
        });
      }
      if (
        slugFunction &&
        values?.active !== 'filename' &&
        !values?.submitting &&
        !values.touched?.filename
      ) {
        const value = slugFunction(values.values, {
          template,
          collection: schemaCollection,
        });
        form.finalForm.change('filename', value);
      }
    },
    fields: [
      collection.ui?.filename?.showFirst && filenameField,
      ...(options.fields as any),
      !collection.ui?.filename?.showFirst && filenameField,
    ].filter((x) => !!x),
  };
};
