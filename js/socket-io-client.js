var manager       = {};
manager.clients   = ko.observableArray([]);
manager.messages  = ko.observableArray([]);

manager.onClientConnect = function (client){
    if (client.status() != "reconnect")
    {
        client.status('connect');
    }
    client.socketId(client.socket.id);
    client.connected(true);
};

manager.onClientDisconnect = function (client){
    client.connected(false);
    client.status('disconnect');
    client.socketId(false);
};

manager.onClientError = function (client, err){
    alert('Client error ' + client.socketId);
    console.error(err);
};

manager.onClientReconnect = function (client){
    client.status('reconnect');
};

manager.clientSubscribe = function (client, topic){
    if ($.inArray(topic, client.topics()) == -1)
    {
        client.topics.push(topic);
    }
    if ($.inArray(topic, client.subscribed()) == -1)
    {
        client.subscribed.push(topic);
        client.socket.on(topic, manager.addMessage.bind(this, client, topic));
    }
};

manager.emitMessage = function (client, topic)
{
    var payload = Array.prototype.slice.call(arguments, 2);
    var args    = [topic].concat(payload);
    console.log(args);
    client.socket.emit.apply(client.socket, args);
};

manager.addMessage = function (client, topic, timestamp)
{
    var msg = {};
    msg.constructor = Message;
    Message.apply(msg, arguments);
    msg.id("m" + manager.messages().length);
    msg.topic(topic);
    manager.messages.unshift(msg);
};

manager.addClient = function (url, opts, topics, themeIndex)
{
    var client;
    if (url instanceof Client)
    {
        client = url;
    }
    else
    {
        if (!opts) opts = {};
        if (typeof opts['force new connection'] == "undefined") opts['force new connection'] = true;

        var client = new Client(url, opts, topics, themeIndex);
        if (typeof themeIndex != "number")
            client.themeIndex(Math.min(manager.clients().length, client.themes.length - 1));
        client.id("c" + manager.clients().length);
        client.status('connecting');
    }

    if (!client.socket) client.connect();
    manager.clients.push(client);
    for (var i in client.topics())
    {
        var topic = client.topics()[i];
        manager.clientSubscribe(client, topic);
    }
};

manager.afterRender = function (els, client)
{
    $(els).find('.theme').selected({
        btnWidth: '120px',
        btnSize: 'xs'
    });
};

manager.now = ko.observable(Date.now());
setInterval(function (){
    manager.now(Date.now());
}, 1000);


Client = function (url, opts, topics, themeIndex)
{
    var self = this;

    self.url        = ko.observable(url  || 'http://');
    self.opts       = ko.observable(opts || {});
    self.connected  = ko.observable(false);
    self.status     = ko.observable("init");
    self.id         = ko.observable("");
    self.socketId   = ko.observable("");
    self.type       = ko.observable("Socket IO");
    self.themeIndex = ko.observable(themeIndex || self.themes.length - 1);
    self.topics     = ko.observableArray(topics || ['message']);
    self.subscribed = ko.observableArray([]);

    self.newTopicFromUI   = ko.observable("");
    self.newPayloadFromUI = ko.observable("");
};

Client.prototype.connect = function ()
{
    var self = this;
    self.socket = io(self.url(), self.opts());
    self.socket.on('connect', function (){
        manager.onClientConnect(self);
    });
    self.socket.on('disconnect', function (){
        manager.onClientDisconnect(self);
    });
    self.socket.on('error', function (err){
        manager.onClientError(self, err);
    });
    self.socket.on('reconnect', function (){
        manager.onClientReconnect(self);
    });
};

Client.prototype.themes = [
    {index: 0, amType: "primary" , caption: "Blue"   },
    {index: 1, amType: "warning" , caption: "Orange" },
    {index: 2, amType: "success" , caption: "Green"  },
    {index: 3, amType: "danger"  , caption: "Red"    },
    {index: 4, amType: "default" , caption: "Gray"   }
];

Client.prototype.onEditTopic = function (client, event)
{
    var keyCode = event.keyCode || event.which;
    if (keyCode == '13')
    {
        var newTopic = $("#" + client.id()).find(".new-topic");
        manager.clientSubscribe(client, newTopic.val());
        newTopic.val("");
    }
    return true;
};

Client.prototype.emitMessage = function ()
{
    manager.emitMessage(this, this.newTopicFromUI(), this.newPayloadFromUI());
    this.newPayloadFromUI('');
};

Message = function (client, timestamp)
{
    var self = this;
    self.client     = client;
    self.timestamp  = timestamp || Date.now();
    self.type       = "text";
    self.id         = ko.observable();
    self.topic      = ko.observable('');
    self.payload    = Array.prototype.slice.call(arguments, 2);
    self.payloadStr = '';

    for (var key in self.payload)
    {
        if (typeof self.payload[key] == "object")
        {
            self.payloadStr += JSON.stringify(self.payload[key], null, 4);
        }
        else
        {
            self.payloadStr += String(self.payload[key]);
        }
        self.payloadStr += "\n";
    }
};

manager.clientToAdd = ko.observable(new Client());

$("#add-client-form").submit(function (){
    manager.addClient($("#add-client-url").val(), {}, $("#add-client-topics").val().split(",").map(function(topic){return topic.trim()}), $("#add-client-theme").val() - 0);
    $("#add-client-popup").modal('close');
    return false;
});

$(document).ready(function (){
    ko.applyBindings(manager);
    $("#add-client-theme").selected();
    $("#clients").on('click', ".client-toggle", function (){
        $(this).parents(".am-panel").children(".am-panel-collapse").collapse('toggle');
    });
});