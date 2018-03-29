import React, { Component, PropTypes } from 'react';
import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import { Form, Button } from 'antd';
import { titleCase } from 'change-case';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import qs from 'query-string';
import fetch from 'isomorphic-fetch';
import { authorize, login, hasAuthority, addPostingAuthority } from '../../utils/auth';
import SteemitAvatar from '../../widgets/SteemitAvatar';
import Loading from '../../widgets/Loading';
import SignForm from '../Form/Sign';
import config from '../../../config.json';
import './Authorize.less';

@connect(
  dispatch => bindActionCreators({
    authorize,
  }, dispatch)
)
export default class Authorize extends Component {
  static propTypes = {
    location: PropTypes.shape({
      query: PropTypes.shape({
        client_id: PropTypes.string,
        response_type: PropTypes.string,
        redirect_uri: PropTypes.string,
        scope: PropTypes.string,
        state: PropTypes.string,
      }),
    }),
    auth: PropTypes.shape(),
  };

  constructor(props) {
    super(props);
    const clientId = this.props.location.query.client_id;
    const responseType = this.props.location.query.response_type || 'token';
    const redirectUri = this.props.location.query.redirect_uri;
    const scope = this.props.location.query.scope || '';
    const state = this.props.location.query.state;
    this.state = {
      clientId,
      responseType,
      redirectUri,
      scope,
      state,
      step: 0,
      scopes: [],
      app: null,
    };
  }

  async componentWillMount() {
    const { scope, clientId } = this.state;
    let scopes = [];
    if (scope !== 'login') {
      if (scope) {
        scopes = scope
          .split(',')
          .filter(o => config.authorized_operations.includes(o) || o === 'offline');
      }
      if (scopes.length === 0) {
        scopes = config.authorized_operations;
      }
    }
    const app = await fetch(`/api/apps/@${clientId}`)
      .then(res => res.json());
    this.setState({ scopes, app });
  }

  componentWillReceiveProps = (props) => {
    const { clientId, responseType, redirectUri, scope, state } = this.state;
    const { auth } = props;
    if (auth.isAuthenticated && auth.user && hasAuthority(auth.user, clientId)) {
      authorize({ clientId, scope, responseType }, (err, res) => {
        window.location = `${redirectUri}?${qs.stringify({ ...res, state })}`;
      });
    } else if (auth.isLoaded) {
      this.setState({ step: 1 });
    }
  };


  authorize = (auth) => {
    const { clientId, responseType, redirectUri, scope, state } = this.state;
    this.setState({ step: 0 });
    login({ ...auth }, () => {
      if (scope === 'login') {
        authorize({ clientId, scope, responseType }, (errA, resA) => {
          window.location = `${redirectUri}?${qs.stringify({ ...resA, state })}`;
        });
      } else {
        addPostingAuthority({ ...auth, clientId }, () => {
          authorize({ clientId, scope, responseType }, (errA, resA) => {
            window.location = `${redirectUri}?${qs.stringify({ ...resA, state })}`;
          });
        });
      }
    });
  };

  render() {
    const { clientId, scope, step, scopes, app } = this.state;
    const requiredRoles = (scope === 'login') ? ['memo', 'posting'] : ['owner', 'active'];
    return (
      <div className="Sign">
        {step === 0 && <Loading />}
        {step !== 0 && <div className="Sign__content">
          <div className="Sign_frame">
            <div className="Sign__header">
              <object data="/img/logo.svg" type="image/svg+xml" id="logo" />
            </div>
            <div className="Sign__wrapper">
              {step === 1 &&
                <Form onSubmit={this.handleSubmit} className="SignForm AuthorizeForm">
                  <div className="Avatars">
                    <div className="Avatar-container">
                      <span className="Avatar" style={{ height: '40px', width: '40px' }}>
                        <object
                          data="/img/logo-c.svg"
                          type="image/svg+xml"
                          id="logo-c"
                          style={{ height: '40px', width: '40px' }}
                        />
                      </span>
                    </div>
                    <div className="Avatar-link" />
                    <div className="Avatar-container">
                      {!app &&
                      <SteemitAvatar username={clientId} size="40" />}
                      {app &&
                      <img
                        src={`https://steemitimages.com/40x40/${app.icon}`}
                        alt="icon"
                      />}
                    </div>
                  </div>
                  <p>
                    {scope === 'login' &&
                    <FormattedMessage
                      id="authorize_login_question"
                      values={{
                        username: <b> {(app && app.name) || `@${clientId}`}</b>,
                      }}
                    />}
                    {scope !== 'login' &&
                    <FormattedMessage
                      id="authorize_question"
                      values={{
                        username: <b> {(app && app.name && `${app.name} (@${clientId})`) || `@${clientId}`}</b>,
                        role: <b><FormattedMessage id="posting" /></b>,
                      }}
                    />}
                  </p>
                  {scopes.length > 0 &&
                  <ul className="authorize-operations">
                    {scopes.map(op => <li><object data="/img/authorize/check.svg" type="image/svg+xml" className="check-icon" />{titleCase(op === 'offline' ? 'offline_access' : op)}</li>)}
                  </ul>}
                  <Form.Item>
                    <Button
                      type="primary" htmlType="button" className="SignForm__button"
                      onClick={() => this.setState({ step: 2 })}
                    >
                      <FormattedMessage id="continue" />
                    </Button>
                  </Form.Item>
                </Form>
              }
              {step === 2 && <SignForm roles={requiredRoles} sign={this.authorize} />}
            </div>
            <div className="Sign__footer">
              <Link to="/" target="_blank" rel="noopener noreferrer"><FormattedMessage id="about_steemconnect" /></Link>
            </div>
          </div>
        </div>}
      </div>
    );
  }
}
