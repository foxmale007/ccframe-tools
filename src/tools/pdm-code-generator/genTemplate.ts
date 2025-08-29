import _, { isFunction } from 'lodash';
import type JSZip from 'jszip';
import * as doT from 'dot';
import DOMAIN_TEMPLATE from './template/domainTemplate.dot?raw';
import MAPPER_TEMPLATE from './template/mapperTemplate.dot?raw';
import SEARCH_TEMPLATE from './template/searchTemplate.dot?raw';

import ISERVICE_TEMPLATE from './template/iServiceTemplate.dot?raw';
import SERVICE_TEMPLATE from './template/serviceTemplate.dot?raw';

import ISEARCH_SERVICE_TEMPLATE from './template/iSearchServiceTemplate.dot?raw';
import SEARCH_SERVICE_TEMPLATE from './template/searchServiceTemplate.dot?raw';

import CONTROLLER_TEMPLATE from './template/controllerTemplate.dot?raw';

Object.assign(doT.templateSettings, {
  evaluate: /\<\%([\s\S]+?)\%\>/g, // 执行 JS 代码
  interpolate: /\<\%=([\s\S]+?)\%\>/g, // 输出表达式
  encode: /\<\%!([\s\S]+?)\%\>/g, // 输出并转义 HTML
  use: /\<\%#([\s\S]+?)\%\>/g,
  define: /\<\%##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\%\>/g,
  conditional: /\<\%\?(\?)?\s*([\s\S]*?)\s*\%\>/g,
  iterate: /\<\%~\s*(?:\%\>|([\s\S]+?)\s*\:\s*([\s\S]+?)\s*(?:\:\s*([\s\S]+?))?\s*\%\>)/g,
  varname: 'it', // 数据对象名
  strip: false, // 去掉多余空格/换行
  append: true,
  selfcontained: false,
});

export function generateAndZipData(basePackage: string, packageName: string, zip: JSZip, tables: any[]): string[] {
  const BASE_DIR = basePackage.replace(/\./g, '/');
  const domainFolder = zip.folder(`${BASE_DIR}/${packageName}/domain/entity`);
  const mapperFolder = zip.folder(`${BASE_DIR}/${packageName}/mapper`);
  const searchFolder = zip.folder(`${BASE_DIR}/${packageName}/search`);
  const serviceFolder = zip.folder(`${BASE_DIR}/${packageName}/service`);
  const controllerFolder = zip.folder(`${BASE_DIR}/${packageName}/controller`);

  const result: string[] = [];
  tables.forEach((table) => {
    if (!table.checked) {
      return;
    }

    const entityName = _.upperFirst(_.camelCase(table.key));
    // fields字段处理和修正
    table.fields.forEach((field: any) => {
      field.dataType = field.dataType.replace(/\(.*$/, '');// dataType 去掉 (和后面的部分
      if (field.dataType === 'enum') { // 将enum修正为char(1)
        field.dataType = 'char';
        field.length = 1;
      }
      field.javaType = getJavaType(field.dataType); // 把pdm类型转化为Java类型
    });

    const keyField = table.fields[0].code;
    const templateData = {
      ...table,
      keyField,
      basePackage,
      packageName,
      entityName,
      camelCase: _.camelCase, // lodash的转驼峰方法
      lowerFirst: _.lowerFirst, // lodash的转驼峰方法
    };
    console.log(`填充对象： ${JSON.stringify(templateData)}`);

    // domain
    const domainFileName = `${entityName}.java`;
    const domainFileData = doT.template(DOMAIN_TEMPLATE)(templateData);
    domainFolder?.file(domainFileName, domainFileData, { binary: false });
    result.push(`生成实体类：\t\t${domainFileName}`);
    // mapper
    const mapperFileName = `${templateData.entityName}Mapper.java`;
    const mapperFileData = doT.template(MAPPER_TEMPLATE)(templateData);
    mapperFolder?.file(mapperFileName, mapperFileData, { binary: false });
    result.push(`生成DB Mapper：\t\t${mapperFileName}`);

    // iService
    const iServiceFileName = `I${templateData.entityName}Service.java`;
    const iServiceFileData = doT.template(ISERVICE_TEMPLATE)(templateData);
    serviceFolder?.file(iServiceFileName, iServiceFileData, { binary: false });
    result.push(`生成Service接口：\t${iServiceFileName}`);
    // service
    const serviceFileName = `${templateData.entityName}Service.java`;
    const serviceFileData = doT.template(SERVICE_TEMPLATE)(templateData);
    serviceFolder?.file(serviceFileName, serviceFileData, { binary: false });
    result.push(`生成Service类：\t\t${serviceFileName}`);

    if (table.genIndex) {
      // search
      const searchFileName = `${templateData.entityName}SearchRepository.java`;
      const searchFileData = doT.template(SEARCH_TEMPLATE)(templateData);
      searchFolder?.file(searchFileName, searchFileData, { binary: false });
      result.push(`生成索引操作类：\t${searchFileName}`);
      // iSearchService
      const iSearchServiceFileName = `I${templateData.entityName}SearchService.java`;
      const iSearchServiceFileData = doT.template(ISEARCH_SERVICE_TEMPLATE)(templateData);
      serviceFolder?.file(iSearchServiceFileName, iSearchServiceFileData, { binary: false });
      result.push(`生成SearchService接口：\t${iSearchServiceFileName}`);
      // searchService
      const searchServiceFileName = `${templateData.entityName}SearchService.java`;
      const searchServiceFileData = doT.template(SEARCH_SERVICE_TEMPLATE)(templateData);
      serviceFolder?.file(searchServiceFileName, searchServiceFileData, { binary: false });
      result.push(`生成SearchService类：\t${searchServiceFileName}`);
    }

    // controller
    const controllerFileName = `${templateData.entityName}Controller.java`;
    const controllerFileData = doT.template(CONTROLLER_TEMPLATE)(templateData);
    controllerFolder?.file(controllerFileName, controllerFileData, { binary: false });
    result.push(`生成Controller类：\t${controllerFileName}`);
  });
  return result;
}

function getJavaType(dbType: string) {
  switch (dbType) {
    case 'bigint':
      return 'Long';
    case 'int':
      return 'Integer';
    case 'char':
    case 'varchar':
    case 'text':
      return 'String';
    case 'double':
      return 'Double';
    case 'datetime':
      return 'Date';
    default:
      return dbType;
  }
}
