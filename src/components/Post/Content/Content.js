// @flow strict
import React from "react";
import styles from "./Content.module.scss";

type Props = {
  body: string,
  title: string,
  readingTime: String,
};

const Content = ({ body, title, readingTime }: Props) => (
  <div className={styles["content"]}>
    <h1 className={styles["content__title"]}>{title}</h1>
    <div className={styles["content__readingTime"]}>{readingTime}</div>
    <div
      className={styles["content__body"]}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  </div>
);

export default Content;
