import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useContext,
} from 'react';
import { Upload, Alert, message, Spin } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import uuidV4 from 'uuid/v4';
import qs from 'query-string';

import File from './File';
import Media from './Media';

import { ext } from '../utils/helper';
import { Context } from '../context';

const { Dragger } = Upload;

// Supported format in paste mode
const accepts = ['image/gif', 'image/png', 'image/jpeg', 'image/bmp'];

export default function Uploader({ type }) {
  const { isAdmin, user, isDev } = useContext(Context);
  const [sign, setSign] = useState({});
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetch(`/api/list?type=${type}`)
      .then(res => res.json())
      .then(json => {
        setLoading(false);
        setList(json);
      });
  }, [type]);

  const getSign = useCallback(() => {
    if (!user && !isDev) return;
    fetch(`/api/signature/${type}`)
    .then(res => {
        if (res.status === 200) {
          return res.json();
        }
        return Promise.reject(res);
      })
      .then(json => setSign(json))
      .catch(err => {
        message.error(err.statusText || err.message || 'Forbidden');
      });
  }, [type]);

  const handleRemove = useCallback((objectId) => {
    setLoading(true);
    fetch(`/api/remove?${qs.stringify({ objectId })}`)
      .then(res => res.json())
      .then(() => {
        setLoading(false);
        handleRefresh();
      });
  }, [handleRefresh]);

  const handleSave = useCallback(({
    name,
    size,
    key,
  }) => {
    setLoading(true);
    fetch(`/api/save?${qs.stringify({ name, size, key, type })}`)
      .then(res => res.json())
      .then(() => {
        setLoading(false);
        handleRefresh();
      });
  }, [type, handleRefresh]);

  const handlePaste = useCallback((e) => {
    if (uploading) return;

    if (!e.clipboardData
      && !e.clipboardData.items
      && e.clipboardData.items.length === 0) {
      message.error('There\'s no image pasted.');
      return;
    }

    if (!accepts.includes(e.clipboardData.items[0].type)) {
      message.error('The format\'s not supported.');
      return;
    }

    const file = e.clipboardData.items[0].getAsFile();
    const form = new FormData();
    const key = `${uuidV4()}${ext(file.name)}`;
    Object.entries({
      ...sign,
      key,
    }).forEach(([k, v]) => {
      form.append(k, v);
    });
    form.append('file', file);

    setUploading(true);
    fetch(sign.host, {
      method: 'POST',
      body: form,
    }).then(res => {
      if (res.status !== 200) {
        return Promise.reject(new Error(res.statusText));
      }
      const { name, size } = file;
      handleSave({ name, size, key });
    }).catch(err => {
      message.error(err.message || 'Upload failed.')
    }).finally(() => {
      setUploading(false);
    });
  }, [uploading, sign, handleSave]);

  useEffect(() => {
    getSign();
    handleRefresh();
  }, [getSign, handleRefresh]);

  useEffect(() => {
    setList([]);
  }, [type]);

  const uploadProps = useMemo(() => ({
    name: 'file',
    multiple: true,
    action: sign.host,
    data(file) {
      file.key = `${uuidV4()}${ext(file.name)}`;
      return {
        ...sign,
        key: file.key,
      }
    },
    accept: type === 'file' ? '*' : `${type}/*`,
    beforeUpload() {
      if (!sign.host) {
        message.error('Sign is invalid');
        return false;
      }
      return true;
    },
    onChange(info) {
      const { status, name, size, originFileObj } = info.file;
      if (status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (status === 'done') {
        const index = info.fileList.map(d => d.uid).indexOf(info.file.uid);
        info.fileList.splice(index, 1);
        message.success(`${info.file.name} uploaded successfully.`);
        handleSave({ name, size, key: originFileObj.key });
      } else if (status === 'error') {
        message.error(`${info.file.name} upload failed.`);
      }
    },
  }), [type, sign, handleSave]);

  return (
    <div onPaste={handlePaste}>
      <input autoFocus style={{ width: 1, height: 1, position: 'absolute' }}></input>
      {!user && (
        <Alert
          style={{ marginBottom: 20 }}
          showIcon
          message="Uploading service is not available for non-login user, please login."
          type="warning"
        />
      )}
      <Spin spinning={uploading}>
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">Drop files{type === 'image' ? '(or paste image)' : ''} here or click to upload.</p>
        </Dragger>
      </Spin>
      <div style={{ marginTop: 20 }}>
        {type === 'file' ? (
          <File
            list={list}
            user={user}
            isAdmin={isAdmin}
            loading={loading}
            handleRemove={handleRemove}
          />
        ) : (
          <Media
            type={type}
            list={list}
            user={user}
            isAdmin={isAdmin}
            loading={loading}
            handleRemove={handleRemove}
          />
        )}
      </div>
    </div>
  );
};
