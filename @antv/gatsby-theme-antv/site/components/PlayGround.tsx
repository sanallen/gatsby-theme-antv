/* eslint no-underscore-dangle: 0 */
import React, { useRef, useEffect, useState, Suspense, lazy } from 'react';
import { useStaticQuery, graphql, Link } from 'gatsby';
import classNames from 'classnames';
import {
  Skeleton,
  Result,
  Layout,
  Space,
  PageHeader,
  Divider,
  TreeSelect,
  Tooltip,
} from 'antd';
import { useMedia } from 'react-use';
import { filter, debounce } from 'lodash-es';
import { LeftOutlined, EditOutlined } from '@ant-design/icons';
import {
  useTranslation,
  withTranslation,
  WithTranslation,
} from 'react-i18next';
import SplitPane from 'react-split-pane';
import { transform } from '@babel/standalone';
import { splitPaneMap } from '../layoutConfig';
import Toolbar, { EDITOR_TABS } from './Toolbar';
import ChartViewSwitcher from './ChartViewSwitcher';
import LayoutSwitcher from './LayoutSwitcher';
import PlayGrounds, { PlayGroundItemProps } from './PlayGrounds';
import ThemeSwitcher from './ThemeSwitcher';
import APIDoc from './APIDoc';
import PageLoading from './PageLoading';
import styles from './PlayGround.module.less';
import { getGithubSourceUrl } from '../templates/document';

const { Content, Sider } = Layout;
interface PlayGroundProps {
  exampleSections: any;
  location: Location;
  description: string;
  markdownRemark: any;
  categories: string[];
  allDemos: any;
}

interface TreeItem {
  title: string;
  value: string;
  children?: any;
}

const MonacoEditor = lazy(() => import('react-monaco-editor'));

const execute = debounce(
  (
    code: string,
    node: HTMLDivElement,
    exampleContainer: string | undefined,
  ) => {
    const script = document.createElement('script');
    script.innerHTML = `
      try {
        ${code}
      } catch(e) {
        if (window.__reportErrorInPlayGround) {
          window.__reportErrorInPlayGround(e);
        }
      }
    `;
    // eslint-disable-next-line no-param-reassign
    node.innerHTML = exampleContainer || '<div id="container" />';
    node!.appendChild(script);
  },
  300,
);

const PlayGround: React.FC<PlayGroundProps> = ({
  exampleSections,
  location,
  markdownRemark,
  description,
  allDemos,
  categories,
}) => {
  const { site } = useStaticQuery(
    graphql`
      query {
        site {
          siteMetadata {
            showChartResize
            themeSwitcher
            showAPIDoc
            githubUrl
            playground {
              extraLib
              container
              playgroundDidMount
              playgroundWillUnmount
              dependencies
              devDependencies
              htmlCodeTemplate
            }
          }
        }
      }
    `,
  );

  const {
    siteMetadata: { githubUrl, playground },
  } = site;

  const { extraLib = '' } = site.siteMetadata.playground;

  const localLayout =
    typeof window !== 'undefined' ? localStorage.getItem('layout') : null;
  const { showChartResize, showAPIDoc, themeSwitcher } = site.siteMetadata;
  const [layout, updateLayout] = useState<string>(localLayout || 'viewDefault');
  const [codeQuery, updateCodeQuery] = useState<string>('');
  const { i18n, t } = useTranslation();
  const [currentExample, updateCurrentExample] = useState<
    PlayGroundItemProps
  >();
  const [editRef, updateEditRef] = useState<any>();
  const { examples } = exampleSections;
  const playgroundNode = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error | null>();
  const [collapsed, updateCollapsed] = useState<boolean>(false);
  const [showAPISearch, updateShowAPIsearch] = useState<boolean>(true);
  const [compiledCode, updateCompiledCode] = useState<string>('');
  const [currentCategory, updateCurrentCategory] = useState<string>('');
  const [relativePath, updateRelativePath] = useState<string | undefined>('');
  const [fileExtension, updateFileExtension] = useState<string | undefined>('');
  const [title, updateTitle] = useState<string | undefined>('');
  const [view, updateView] = useState<string>('desktop');
  const [theme, updateTheme] = useState<string>();
  const [docsEmpty, updateDocsEmpty] = useState<boolean>(false);
  const [currentSourceCode, updateCurrentSourceCode] = useState<string>('');
  const [currentSourceData, updateCurrentSourceData] = useState(null);
  const editroRef = useRef<any>(null);
  const isWide = useMedia('(min-width: 767.99px)', true);

  const comment =
    i18n.language === 'zh'
      ? `// 我们用 insert-css 演示引入自定义样式
// 推荐将样式添加到自己的样式文件中
// 若拷贝官方代码，别忘了 npm install insert-css
insertCss(`
      : `// We use 'insert-css' to insert custom styles
// It is recommended to add the style to your own style sheet files
// If you want to copy the code directly, please remember to install the npm package 'insert-css
insertCss(`;
  const replaceInsertCss = (str: string) => {
    // 统一增加对 insert-css 的使用注释
    return str.replace(/^insertCss\(/gm, comment);
  };

  if (typeof window !== 'undefined') {
    (window as any).__reportErrorInPlayGround = (e: Error) => {
      console.error(e); // eslint-disable-line no-console
      setError(e);
    };
  }

  const updateCurrentExampleParams = (current: PlayGroundItemProps) => {
    if (!current?.relativePath) return;
    updateRelativePath(current?.relativePath);
    updateFileExtension(
      current?.relativePath.split('.')[
        current.relativePath.split('.').length - 1
      ] || 'js',
    );
    updateTitle(current?.title);
    updateCompiledCode(current.babeledSource);
    updateCurrentSourceCode(replaceInsertCss(current.source));
  };

  const setLayout = (ifWide: boolean, empty: boolean) => {
    if (!ifWide) {
      updateLayout('viewTwoRows');
      updateCollapsed(true);
    } else if (!showAPIDoc || empty) {
      updateLayout('viewTwoCols');
    }
  };

  useEffect(() => {
    if (currentExample || !examples) return;
    const defaultExample =
      examples.find(
        (item: any) => `#${item.filename.split('.')[0]}` === location.hash,
      ) || examples[0];
    updateCurrentExample(defaultExample);
    if (
      !exampleSections?.design?.node?.html &&
      !description &&
      !exampleSections?.API?.node?.html
    ) {
      updateDocsEmpty(true);
    }
  }, [examples, description]);

  useEffect(() => {
    setLayout(isWide, docsEmpty);
  }, [isWide, docsEmpty]);

  useEffect(() => {
    if (!currentExample || !allDemos) return;

    updateView('desktop');
    updateCurrentExampleParams(currentExample);
    filter(allDemos, (item: any, key: string) => {
      const cur = item.find(
        (val: any) => val?.relativePath === currentExample.relativePath,
      );
      if (cur) updateCurrentCategory(key);
      return item;
    });
  }, [currentExample, allDemos]);

  const executeCode = () => {
    if (!compiledCode || !playgroundNode || !playgroundNode.current) {
      return;
    }
    execute(compiledCode, playgroundNode.current, playground?.container);
  };

  useEffect(() => {
    executeCode();
  }, [compiledCode, error, view]);

  useEffect(() => {
    if (playground?.playgroundDidMount) {
      // eslint-disable-next-line no-new-func
      new Function(playground?.playgroundDidMount)();
    }
    return () => {
      if (playground?.playgroundWillUnmount) {
        // eslint-disable-next-line no-new-func
        new Function(playground?.playgroundWillUnmount)();
      }
    };
  }, []);

  const [editorTabs, updateEditroTabs] = useState<EDITOR_TABS[]>([]);
  const [currentEditorTab, updateCurrentEditorTab] = useState(
    EDITOR_TABS.JAVASCRIPT,
  );
  useEffect(() => {
    const dataFileMatch = currentSourceCode.match(/fetch\('(.*)'\)/);

    if (dataFileMatch && dataFileMatch.length > 0) {
      updateEditroTabs([EDITOR_TABS.JAVASCRIPT, EDITOR_TABS.DATA]);
      fetch(dataFileMatch[1])
        .then((response) => response.json())
        .then((data) => {
          updateCurrentSourceData(data);
        });
    }
  }, [currentSourceCode]);

  const onCodeChange = (value: string) => {
    if (currentEditorTab === EDITOR_TABS.JAVASCRIPT) {
      updateCurrentSourceCode(value);
      try {
        const { code } = transform(value, {
          filename: relativePath,
          presets: ['react', 'typescript', 'es2015', 'stage-3'],
          plugins: ['transform-modules-umd'],
        });
        updateCompiledCode(code);
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
        setError(e);
        return;
      }
      setError(null);
    }
  };

  useEffect(() => {
    if (editroRef.current) {
      if (currentEditorTab === EDITOR_TABS.JAVASCRIPT) {
        editroRef.current.setValue(currentSourceCode);
      } else if (currentEditorTab === EDITOR_TABS.DATA) {
        editroRef.current.setValue(JSON.stringify(currentSourceData, null, 2));
      }
    }
  }, [currentEditorTab]);

  const codeEditor = (
    <MonacoEditor
      height="calc(100% - 32px)"
      language={
        currentEditorTab === EDITOR_TABS.JAVASCRIPT ? 'javascript' : 'json'
      }
      value={currentSourceCode}
      options={{
        readOnly: currentEditorTab === EDITOR_TABS.DATA,
        automaticLayout: true,
        minimap: {
          enabled: false,
        },
        scrollBeyondLastLine: false,
        fixedOverflowWidgets: true,
      }}
      onChange={(value) => onCodeChange(value)}
      editorWillMount={(monaco: any) => {
        monaco.editor.defineTheme('customTheme', {
          base: 'vs',
          inherit: true,
          rules: [],
          colors: {
            'editor.inactiveSelectionBackground': '#ffffff',
          },
        });
        monaco.editor.setTheme('customTheme');

        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          extraLib,
          '',
        );
      }}
      editorDidMount={(editor, monaco) => {
        updateEditRef(editor);
        editor.addAction({
          // An unique identifier of the contributed action.
          id: 'search-in-doc',

          // A label of the action that will be presented to the user.
          label: 'search in document',

          contextMenuGroupId: 'navigation',

          // An optional array of keybindings for the action.
          keybindings: [
            // eslint-disable-next-line no-bitwise
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.F10,
          ],

          contextMenuOrder: 0,
          run: (ed: any) => {
            const val = ed.getModel().getValueInRange(ed.getSelection());
            updateCodeQuery(val);
          },
        });
        editroRef.current = editor.getModel();
      }}
    />
  );

  const dispatchResizeEvent = () => {
    const e = new Event('resize');
    window.dispatchEvent(e);
  };

  const toggle = () => {
    updateCollapsed(!collapsed);
  };

  useEffect(() => {
    dispatchResizeEvent();
    if (isWide && showAPIDoc && !docsEmpty)
      localStorage.setItem('layout', layout);
    const pane = document.getElementsByClassName('ant-layout');
    if (!pane[1]) return;
    if (layout === 'viewTwoRows') {
      pane[1].setAttribute('style', 'margin-top: 64px');
    } else {
      pane[1].setAttribute('style', 'margin-top: 0');
    }
  }, [layout, collapsed]);

  // 图例滚动到当前节点
  useEffect(() => {
    if (!currentExample || !currentExample?.filename || !layout) {
      return;
    }
    const id = `example-${currentExample?.filename?.split('.')[0]}`;
    const cardNode = document.getElementById(id);

    if (cardNode) {
      cardNode.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentExample, layout, playground]);

  const getThemeCode = (type: string, themeString: string) => {
    const colors = JSON.parse(themeString);

    let res;
    if (type === 'g2') {
      res = {
        styleSheet: {
          brandColor: colors.colors10[0],
          paletteQualitative10: colors.colors10,
          paletteQualitative20: colors.colors20,
        },
      };
    } else {
      res = {
        theme: {
          styleSheet: {
            brandColor: colors.colors10[0],
            paletteQualitative10: colors.colors10,
            paletteQualitative20: colors.colors20,
          },
        },
      };
    }

    return JSON.stringify(res);
  };

  useEffect(() => {
    if (!currentSourceCode || !theme || !themeSwitcher) return;

    let source = currentSourceCode;
    const render = source.match(/(\S*).render()/);
    if (render && render?.length > 0) {
      const chart = render[1];
      let themeCode;
      let reg;
      if (themeSwitcher === 'g2') {
        themeCode = `${chart}.theme(${getThemeCode('g2', theme)});`;
        reg = new RegExp(`( *)${chart}.theme(.*);*(\n*)`, 'g');
        if (source.match(reg)) source = source.replace(reg, '');
      } else if (themeSwitcher === 'g2plot') {
        themeCode = `${chart}.update(${getThemeCode('g2plot', theme)});`;
        reg = new RegExp(`( *)${chart}.update(.*);\n`, 'g');
        if (source.match(reg)) source = source.replace(reg, '');
      }
      const data = source.replace(
        `${chart}.render()`,
        `${themeCode}\n${chart}.render()`,
      );
      onCodeChange(data);
      editRef.getAction('editor.action.formatDocument').run();
    }
  }, [theme]);

  // 根据pane框度及当前视图判断是否需要展示API文档搜索框
  const calcShowSearch = (size: number) => {
    const clientw = document.body.clientWidth;
    if (size / clientw > 0.668) {
      updateShowAPIsearch(false);
    } else {
      updateShowAPIsearch(true);
    }
  };

  const routes = [
    {
      path: `/${i18n.language}/examples`,
      breadcrumbName: i18n.language === 'zh' ? '图表示例' : 'Gallery',
    },
    {
      path: '/category',
      breadcrumbName: 'Second-level Menu',
      children: [],
    },
  ];

  const getTreeData = () => {
    const result: TreeItem[] = [];
    categories.forEach((category: string) => {
      const root: TreeItem = {
        title: category,
        value: '',
        children: [],
      };

      allDemos[category].forEach((item: any, index: number) => {
        const demoSlug = item.relativePath.replace(
          /\/demo\/(.*)\..*/,
          (_: string, filename: string) => {
            return `#${filename}`;
          },
        );
        const path = `/${i18n.language}/examples/${demoSlug}`;
        if (index === 0) {
          root.value = `root::${path}`;
        }
        const child = {
          title:
            typeof item.title === 'object'
              ? item.title[i18n.language]
              : item.title || item?.filename,
          value: path,
        };
        root.children.push(child);
      });

      result.push(root);
    });
    return result;
  };

  const onChange = (value: string) => {
    const tmp = value.split('::');
    const path = tmp[1] ? tmp[1] : value;
    // window.location.assign(path);
    // window.location.href = `${path}`;

    window.history.pushState({}, '', `${path}`);
    window.location.reload();
  };

  function itemRender(route: any) {
    if (route.children) {
      return (
        <TreeSelect
          className={styles.breadDrop}
          style={{ width: '100%' }}
          value={currentCategory}
          bordered={false}
          dropdownStyle={{
            maxHeight: 640,
            overflow: 'auto',
            color: '#7d8a96 !important',
            paddingRight: '8px',
          }}
          dropdownClassName={styles.breadDropItem}
          dropdownMatchSelectWidth={false}
          treeData={getTreeData()}
          placeholder="Please select"
          treeDefaultExpandAll
          onChange={onChange}
        />
      );
    }

    return (
      <Link key={route.path} to={route.path}>
        {route.breadcrumbName}
      </Link>
    );
  }

  return (
    <SplitPane
      split={splitPaneMap[layout].outside.split}
      size={splitPaneMap[layout].outside.size}
      onDragFinished={dispatchResizeEvent}
      onChange={(size) => calcShowSearch(size)}
    >
      {playground && currentExample && layout ? (
        <SplitPane
          split={splitPaneMap[layout].inside.split}
          size={splitPaneMap[layout].inside.size}
          onDragFinished={dispatchResizeEvent}
          className={styles.playground}
        >
          <Layout className={styles.playgroundCard}>
            <Sider
              collapsedWidth={0}
              width={120}
              trigger={null}
              collapsible
              collapsed={collapsed}
              className={styles.menuSider}
              theme="light"
            >
              <PlayGrounds
                examples={examples}
                currentExample={currentExample}
                updateCurrentExample={updateCurrentExample}
              />
            </Sider>

            <LeftOutlined
              className={styles.trigger}
              type={collapsed ? 'menu-unfold' : 'menu-fold'}
              onClick={toggle}
              rotate={collapsed ? 180 : 0}
            />

            {relativePath ? (
              <Layout>
                <PageHeader
                  ghost={false}
                  breadcrumb={isWide ? { routes, itemRender } : {}}
                  title={
                    typeof currentExample.title === 'object'
                      ? currentExample.title[i18n.language]
                      : currentExample.title
                  }
                  subTitle={
                    <Tooltip title={t('在 GitHub 上编辑')}>
                      <a
                        href={getGithubSourceUrl({
                          githubUrl,
                          relativePath,
                          prefix: 'examples',
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.editOnGtiHubButton}
                      >
                        <EditOutlined />
                      </a>
                    </Tooltip>
                  }
                  extra={
                    <Space split={<Divider type="vertical" />}>
                      {showChartResize && layout === 'viewDefault' && (
                        <ChartViewSwitcher
                          updateView={updateView}
                          view={view}
                        />
                      )}
                      {showAPIDoc && !docsEmpty && layout !== 'viewTwoRows' && (
                        <LayoutSwitcher updateLayout={updateLayout} />
                      )}
                      {themeSwitcher && (
                        <ThemeSwitcher updateTheme={updateTheme} />
                      )}
                    </Space>
                  }
                />
                <Content className={styles.chartContainer}>
                  <div
                    className={classNames(
                      styles.preview,
                      `playground-${relativePath.split('/').join('-')}`,
                    )}
                  >
                    {error ? (
                      <Result
                        status="error"
                        title={
                          i18n.language === 'zh'
                            ? '演示代码报错，请检查'
                            : 'Demo code error, please check'
                        }
                        subTitle={<pre>{error && error.message}</pre>}
                      />
                    ) : (
                      <div ref={playgroundNode} className={styles[view]} />
                    )}
                  </div>
                </Content>
              </Layout>
            ) : (
              <Skeleton paragraph={{ rows: 8 }} className={styles.skeleton} />
            )}
          </Layout>

          <div className={styles.editor}>
            {title && fileExtension && (
              <Toolbar
                fileExtension={fileExtension}
                sourceCode={currentSourceCode}
                playground={playground}
                location={location}
                title={title}
                onExecuteCode={executeCode}
                editorTabs={editorTabs}
                currentEditorTab={currentEditorTab}
                onEditorTabChange={updateCurrentEditorTab}
                onToggleFullscreen={null}
              />
            )}
            {!relativePath ? (
              <Skeleton paragraph={{ rows: 8 }} className={styles.skeleton} />
            ) : (
              <div className={styles.monaco}>
                <Suspense fallback={<PageLoading />}>{codeEditor}</Suspense>
              </div>
            )}
          </div>
        </SplitPane>
      ) : (
        <></>
      )}

      {relativePath &&
      (layout === 'viewDefault' || layout === 'viewThreeCols') ? (
        <APIDoc
          markdownRemark={markdownRemark}
          githubUrl={githubUrl}
          relativePath={relativePath}
          exampleSections={exampleSections}
          description={description}
          codeQuery={codeQuery}
          showAPISearch={showAPISearch}
        />
      ) : (
        <></>
      )}
    </SplitPane>
  );
};

class ErrorHandlerPlayGround extends React.Component<
  PlayGroundProps & WithTranslation,
  { error?: Error }
> {
  state = {
    error: undefined,
  };

  static getDerivedStateFromError(error: Error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { error };
  }

  render() {
    const { t } = this.props;
    const { error } = this.state;
    if (error) {
      // 你可以自定义降级后的 UI 并渲染
      return (
        <Result
          status="error"
          title={t('演示代码报错，请检查')}
          subTitle={<pre>{error && (error as any).message}</pre>}
        />
      );
    }
    return <PlayGround {...this.props} />;
  }
}

export default withTranslation()(ErrorHandlerPlayGround);
