import React, {Component} from 'react';
import CommonTitleBar from '../views/CommonTitleBar';
import Global from '../utils/Global';
import Utils from '../utils/Utils';
import TimeUtils from '../utils/TimeUtil';
import TimeUtil from '../utils/TimeUtil';
import ChatBottomBar from '../views/ChatBottomBar';
import EmojiView from '../views/EmojiView';
import MoreView from '../views/MoreView';
import LoadingView from '../views/LoadingView';
import StorageUtil from '../utils/StorageUtil';
import CountEmitter from '../event/CountEmitter';
import ConversationUtil from '../utils/ConversationUtil';

import {
  Dimensions,
  FlatList,
  Image,
  PixelRatio,
  StyleSheet,
  Text,
  View,
  ToastAndroid,
  DeviceEventEmitter
} from 'react-native'
import NativeDealMessage from '../native/NativeDealMessage'
import NativeCustomerServerSet from '../native/NativeCustomerServerSet'
import ZoomImage from '../widget/ZoomImage'

const {width} = Dimensions.get('window');
const MSG_LINE_MAX_COUNT = 15;

export default class ChattingScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showEmojiView: false,
      showMoreView: false,
      showProgress: false,
      isSessionStarted: false,
      conversation: null,
      isLoginServer:'',
      messagessss: []
    };

    ConversationUtil.getConversations("hongwang", (data) => {
      console.log(JSON.stringify(data));
      if (data != null && data.length !==0) {
        this.setState({conversation: data, messagessss: data[0].messages});
        console.log(this.state.messagessss);
      }
    })
  }

  componentWillMount() {

    CountEmitter.addListener('notifyChattingRefresh', () => {
      // 刷新消息
      ConversationUtil.getConversations("hongwang", (data) => {
        if (data != null) {
          this.setState({conversation: data, messagessss: data.messagessss}, ()=>{
            console.log('result: ' + JSON.stringify(data).toString());
            this.scroll();
          });
        }
      });

    });

    this.createAccount();
    this.receiveTextMessage();
    this.receiveImageMessage();
  }



  /**
   * 设置账号，注册
   * @returns {Promise<void>}
   */
  createAccount = async () => {
    let login = await NativeCustomerServerSet.setCustomerAccout("hongwang", "123456");
    console.log("isLogin: " + login.isLogin);
    this.setState({isLoginServer:login.isLogin});
    if (this.state.isLoginServer === "true"){
      StorageUtil.set('hasLogin', {'hasLogin': true});
      StorageUtil.set('username', {'username': "hongwang"});
      StorageUtil.set('password', {'password': "123456"});
    }
  };

  receiveTextMessage = () => {
    DeviceEventEmitter.addListener('receiveTextMessage', (e) => {
      console.log("receiveTextMessage: " + e.textMessage + "======" + e.messageId);
      if (Utils.isEmpty(e)) {
        return;
      }
      
      let message  = e.textMessage;
      let meesageId  = e.messageId;

      this.concatMessage({
        'conversationId':ConversationUtil.generateConversationId("hongwang", "hongwang"),
        'id': meesageId,
        'receiveMessage': message,
        'sendMessage': "",
        'messageTime': TimeUtil.currentTime(),
        'messageState': "receive",
        'messageType': 'txt'
      })
    });
  }

  receiveImageMessage = () => {
    DeviceEventEmitter.addListener('receiveImageMessage', (e) => {
      console.log("receiveImageMessage: " + e);
      if (Utils.isEmpty(e)) {
        return;
      }

      let message  = e.imageMessage;
      let meesageId  = e.messageId;
      let imageWidth = e.imageWidth;
      let imageHeight = e.imageHeight;


      this.concatMessage({
        'conversationId':ConversationUtil.generateConversationId("hongwang", "hongwang"),
        'id': meesageId,
        'receiveMessage': message,
        'sendMessage': "",
        'messageTime': TimeUtil.currentTime(),
        'messageState': "receive",
        'attribute':{imageWidth: imageWidth, imageHeight: imageHeight},
        'messageType': 'image'
      })
    });
  }

  handleSendBtnClick = (msg) => {
    this.sendTextMessage(msg);
  }

  sendTextMessage = async (msg) =>{ // 发送文本消息
    let sendMessage = await NativeDealMessage.sendTextMessage(msg);
    console.log("isLogin: " + sendMessage.sendMessages);
    // 还需要将本条消息添加到当前会话中
    this.concatMessage({
      'conversationId':ConversationUtil.generateConversationId("hongwang", "hongwang"),
      'id': sendMessage.sendMessages,
      'receiveMessage': "",
      'sendMessage': msg,
      'messageTime': TimeUtil.currentTime(),
      'messageState': "send",
      'messageType': 'txt'
    })
  }

  sendImageMessage = async (image) => { // 发送图片消息
    let imagePath = image.path;
    let imageWidth = image.width;
    let imageHeight = image.height;
    console.log("imagePath: " + imagePath);
    let sendMessage = await NativeDealMessage.sendImageMessage(imagePath);
    console.log("isLogin: " + sendMessage.sendMessages);

    // 还需要将本条消息添加到当前会话中
    this.concatMessage({
      'conversationId':ConversationUtil.generateConversationId("hongwang", "hongwang"),
      'id': sendMessage.sendMessages,
      'receiveMessage': "",
      'sendMessage': imagePath,
      'messageTime': TimeUtil.currentTime(),
      'messageState': "send",
      'attribute':{imageWidth: imageWidth, imageHeight: imageHeight},
      'messageType': 'image'
    })
  }

  sendMojiMessage = async (moji) => {
    console.log("moji: " + moji);
    this.setState({inputMsg: moji});
  }

  scroll() {
    this.scrollTimeout = setTimeout(() => this.refs.flatList.scrollToEnd(), 0);
  }

  concatMessage(message) {
    ConversationUtil.addMessage(message, () => {
      // 发送完消息，还要通知会话列表更新
      CountEmitter.emit('notifyConversationListRefresh');
    });
    let msgs = this.state.messagessss;
    msgs.push(message);
    console.log(msgs);
    console.log("msgs result: " + JSON.stringify(msgs));
    this.setState({messagessss: msgs}, ()=>{
      this.scroll();
    });
  }

  componentWillUnmount() {
    this.scrollTimeout && clearTimeout(this.scrollTimeout);
    CountEmitter.removeListener('notifyChattingRefresh', ()=>{});
    // 通知会话列表刷新未读数
    if (this.conversationId) {
      ConversationUtil.clearUnreadCount(this.conversationId, ()=>{
        CountEmitter.emit('notifyConversationListRefresh');
      })
    }
  }

  updateView = (emoji, more) => {
    this.setState({
      showEmojiView: emoji,
      showMoreView: more,
    })
  }

  _keyExtractor = (item, index) => index

  shouldShowTime(item) { // 该方法判断当前消息是否需要显示时间
    let index = item.index;
    if (index === 0) {
      // 第一条消息，显示时间
      return true;
    }
    if (index > 0) {
      let messages = this.state.messagessss;
      if (!Utils.isEmpty(messages) && messages.length > 0) {
        let preMsg = messages[index - 1];
        let delta = item.item.time - preMsg.time;
        if (delta > 3 * 60) {
          return true;
        }
      }
      return false;
    }
  }

  render() {
    var moreView = [];
    if (this.state.showEmojiView) {
      moreView.push(
        <View key={"emoji-view-key"}>
          <View style={{width: width, height: 1 / PixelRatio.get(), backgroundColor: Global.dividerColor}}/>
          <View style={{height: Global.emojiViewHeight}}>
            <EmojiView
              handlerSendMoji={this.sendMojiMessage.bind(this)}/>
          </View>
        </View>
      );
    }
    if (this.state.showMoreView) {
      moreView.push(
        <View key={"more-view-key"}>
          <View style={{width: width, height: 1 / PixelRatio.get(), backgroundColor: Global.dividerColor}}/>
          <View style={{height: Global.emojiViewHeight}}>
            <MoreView
              sendImageMessage={this.sendImageMessage.bind(this)}
            />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <CommonTitleBar title={this.chatUsername} nav={this.props.navigation}/>
        {
          this.state.showProgress ? (
            <LoadingView cancel={() => this.setState({showProgress: false})}/>
          ) : (null)
        }
        <View style={styles.content}>
          <FlatList
            ref="flatList"
            data={this.state.messagessss}
            renderItem={this.renderItem}
            keyExtractor={this._keyExtractor}
            extraData={this.state}
          />
        </View>
        <View style={styles.divider}/>
        <View style={styles.bottomBar}>
          <ChatBottomBar updateView={this.updateView} handleSendBtnClick={this.handleSendBtnClick}/>
        </View>
        {moreView}
      </View>
    );
  }

  renderItem = (item) => {
    let msgType = item.item.messageType;
    if (msgType === 'txt') {
      // 文本消息
      if (item.item.messageState ==="receive") {
        return this.renderReceivedTextMsg(item);
      } else {
        return this.renderSendTextMsg(item);
      }
    } else if (msgType === 'image') {
      // 图片消息
      if (item.item.messageState === "receive") {
        return this.renderReceivedImgMsg(item);
      } else {
        return this.renderSendImgMsg(item);
      }
    }
  }

  renderReceivedTextMsg(item) { // 接收的文本消息
    let contactAvatar = require('../../images/avatar.png');
    // if (!Utils.isEmpty(this.chatWithAvatar)) {
    //   contactAvatar = this.chatWithAvatar;
    // }
    return (
      <View style={{flexDirection: 'column', alignItems: 'center'}}>
        {
          this.shouldShowTime(item) ? (
            <Text style={listItemStyle.time}>{TimeUtils.formatChatTime(parseInt(item.item.messageTime))}</Text>
          ) : (null)
        }
        <View style={listItemStyle.container}>
          <Image style={listItemStyle.avatar} source={contactAvatar}/>
          <View style={listItemStyle.msgContainer}>
            <Text style={listItemStyle.msgText}>{item.item.receiveMessage}</Text>
          </View>
        </View>
      </View>
    );
  }

  renderSendTextMsg(item) { // 发送出去的文本消息
    let avatar = require('../../images/avatar.png');
    // if (!Utils.isEmpty(this.state.userInfo.avatar)) {
    //   avatar = {uri: this.state.userInfo.avatar};
    // }
    // 发送出去的消息
    return (
      <View style={{flexDirection: 'column', alignItems: 'center'}}>
        {
          this.shouldShowTime(item) ? (
            <Text style={listItemStyle.time}>{TimeUtils.formatChatTime(parseInt(item.item.messageTime))}</Text>
          ) : (null)
        }
        <View style={listItemStyle.containerSend}>
          <View style={listItemStyle.msgContainerSend}>
            <Text style={listItemStyle.msgText}>{item.item.sendMessage}</Text>
          </View>
          <Image style={listItemStyle.avatar} source={avatar}/>
        </View>
      </View>
    );
  }

  renderReceivedImgMsg(item) { // 接收的图片消息
    let contactAvatar = require('../../images/avatar.png');
    // if (!Utils.isEmpty(this.chatWithAvatar)) {
    //   contactAvatar = this.chatWithAvatar;
    // }
    return (
      <View style={{flexDirection: 'column', alignItems: 'center'}}>
        {
          this.shouldShowTime(item) ? (
            <Text style={listItemStyle.time}>{TimeUtils.formatChatTime(parseInt(item.item.messageTime))}</Text>
          ) : (null)
        }
        <View style={listItemStyle.container}>
          <Image style={listItemStyle.avatar} source={contactAvatar}/>
          <View style={[listItemStyle.msgContainer, {paddingLeft: 0, paddingRight: 0}]}>
            <ZoomImage
              source={{uri: item.item.receiveMessage}}
              style={{borderRadius: 3}}
              imgStyle={{width: 150, height: 150  * (item.item.attribute.imageHeight / item.item.attribute.imageWidth)}}
              enableScaling={true}
            />
          </View>
        </View>
      </View>
    );
  }

  renderSendImgMsg(item) { // 发送的图片消息
    let avatar = require('../../images/avatar.png');
    // if (!Utils.isEmpty(this.state.userInfo.avatar)) {
    //   avatar = {uri: this.state.userInfo.avatar};
    // }
    // 发送出去的消息
    return (
      <View style={{flexDirection: 'column', alignItems: 'center'}}>
        {
          this.shouldShowTime(item) ? (
            <Text style={listItemStyle.time}>{TimeUtils.formatChatTime(parseInt(item.item.messageTime))}</Text>
          ) : (null)
        }
        <View style={listItemStyle.containerSend}>
          <View style={[listItemStyle.msgContainerSend, {paddingLeft: 0, paddingRight: 0}]}>
            <ZoomImage
              source={{uri: item.item.sendMessage}}
              style={{borderRadius: 3}}
              imgStyle={{width: 150, height: 150  * (item.item.attribute.imageHeight / item.item.attribute.imageWidth)}}
              enableScaling={true}
            />
          </View>
          <Image style={listItemStyle.avatar} source={avatar}/>
        </View>
      </View>
    );
  }
}

const listItemStyle = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    flexDirection: 'row',
    padding: 5,
  },
  avatar: {
    width: 40,
    height: 40,
  },
  msgContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    paddingLeft: 8,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  msgContainerSend: {
    backgroundColor: '#9FE658',
    borderRadius: 3,
    paddingLeft: 8,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 24,
  },
  containerSend: {
    flex: 1,
    width: width,
    flexDirection: 'row',
    padding: 5,
    justifyContent: 'flex-end',
  },
  time: {
    backgroundColor: '#D4D4D4',
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 5,
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 11,
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: Global.pageBackgroundColor
  },
  bottomBar: {
    height: 50,
  },
  divider: {
    width: width,
    height: 1 / PixelRatio.get(),
    backgroundColor: Global.dividerColor,
  }
});
