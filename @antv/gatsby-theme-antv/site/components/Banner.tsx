import React from 'react';
import Notification from './Notification';
import { Modal } from 'antd';
import styles from './Banner.module.less';
import GitHubButton from 'react-github-button';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { repository } from '../../package.json';

interface Notification {
  type: string;
  title: string;
  date: string;
  link?: string;
}

interface BannerButton {
  text: string;
  link: string;
  style?: React.CSSProperties;
  type?: string;
}

interface BannerProps {
  coverImage?: React.ReactNode;
  title: string;
  description: string;
  notifications?: Notification[];
  style?: React.CSSProperties;
  className?: string;
  video?: string;
  showGithubStars?: boolean;
  buttons?: BannerButton[];
}

const numImgs = [
  'https://gw.alipayobjects.com/mdn/rms_f8c6a0/afts/img/A*ViOPRKPsVzoAAAAAAAAAAABkARQnAQ',
  'https://gw.alipayobjects.com/mdn/rms_f8c6a0/afts/img/A*NFADS6PF0DYAAAAAAAAAAABkARQnAQ',
];

const backLeftBottom =
  'https://gw.alipayobjects.com/zos/basement_prod/441d5eaf-e623-47cd-b9b9-2a581d9ce1e3.svg';

const Banner: React.FC<BannerProps> = ({
  coverImage,
  title,
  description,
  notifications = [],
  style = {},
  className,
  video,
  showGithubStars = true,
  buttons = [],
}) => {
  const { t } = useTranslation();

  const insNotifications: Notification[] = [
    {
      type: t('更新'),
      title: t('L7 发布新版本，让地图动起来！'),
      date: '2019.12.04',
      link: '',
    },
    {
      type: t('推荐'),
      title: t('Kitchen 3.75，效率大幅提升！'),
      date: '2019.12.03',
      link: '',
    },
  ];
  if (notifications) {
    notifications.forEach((noti, i) => {
      insNotifications[i] = noti;
    });
  }
  const getNotifications = () => {
    const children = insNotifications.map((notification, i) => {
      if (i > 1) return;
      let cstyle;
      switch (i) {
        case 0: {
          cstyle = styles.noti0;
          break;
        }
        case 1: {
          cstyle = styles.noti1;
          break;
        }
        default: {
          break;
        }
      }
      return (
        <a href={notification.link} key={i} className={styles.notiWrapper}>
          <Notification
            className={cstyle}
            numImg={numImgs[i]}
            notificationContent={notification}
          />
        </a>
      );
    });
    return children;
  };

  const showVideo = () => {
    Modal.info({
      title: 'This is a notification message',
      content: (
        <video
          className={styles.video}
          style={{ width: '100%', height: '100%', objectFit: 'fill' }}
          controls
          src="https://mdn.alipayobjects.com/afts/file/A*grJPTKqmP9QAAAAAAAAAAABjAQAAAQ?bz=antv_site"
        />
      ),
      width: '70%',
    });
  };

  const renderButtons = buttons.map((button: BannerButton, i) => (
    <a key={i} href={button.link} style={{ marginLeft: i === 0 ? '0%' : '2%' }}>
      <button
        className={classNames(styles.button, styles[button.type || ''])}
        style={button.style}
      >
        {button.text}
      </button>
    </a>
  ));

  if (video) {
    renderButtons.push(
      <div key="video" onClick={showVideo} className={styles.videoButton} />,
    );
  }

  if (showGithubStars) {
    const githubUrl = repository.url;
    const user = githubUrl.split('/')[3];
    const repo = githubUrl.split('/')[4];
    renderButtons.push(
      <div key="github" className={styles.githubWrapper}>
        <GitHubButton
          type="stargazers"
          size="large"
          namespace={user}
          repo={repo}
        />
      </div>,
    );
  }

  return (
    <section className={classNames(styles.wrapper, className)} style={style}>
      <div className={styles.content}>
        <div className={styles.text}>
          <div className={styles.title}>{title}</div>
          <p className={styles.description}>{description}</p>
          <div className={styles.buttons}>{renderButtons}</div>
        </div>
        <div className={styles.notifications}>{getNotifications()}</div>
        <div className={styles.teaser}>
          <div className={styles.teaserimg}>{coverImage}</div>
        </div>
        <img
          className={styles.backLeftBottom}
          src={backLeftBottom}
          alt="back"
        />
      </div>
    </section>
  );
};

export default Banner;
