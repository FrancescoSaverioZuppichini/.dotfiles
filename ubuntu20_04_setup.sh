#!/bin/bash
# My config
## link your stuff
ln -s ~/.dotfiles/.icons ~/.icons
ln -s ~/.dotfiles/.themes ~/.themes
ln -s ~/.dotfiles/.zshrc ~/.zshrc 
ln -s ~/.dotfiles/.hyper.js ~/.hyper.js 
ln -s ~/.dotfiles/.gitconfig ~/.gitconfig
# Install software
## Install VS code https://linuxize.com/post/how-to-install-visual-studio-code-on-ubuntu-18-04/
apt update
wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | sudo apt-key add -
add-apt-repository "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main"
apt update
apt install code -y
## Install anaconda
wget /tmp/https://repo.anaconda.com/archive/Anaconda3-2020.11-Linux-x86_64.sh
# sha256sum Anaconda3-2020.11-Linux-x86_64.sh 
chmod 755 /tmp/Anaconda3-2020.11-Linux-x86_64.sh
/tmp/Anaconda3-2020.11-Linux-x86_64.sh
# create conda env for deep learning (run from current shell)
source ~/anaconda3/etc/profile.d/conda.sh
conda create -n dl python=3.8
conda activate dl
pip install -R requirements.txt
## install docker
apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
apt-get update
apt-get install docker-ce docker-ce-cli containerd.io -y
# to verify run sudo docker run hello-world
usermod -aG docker $USER
# docker compose https://docs.docker.com/compose/install/
sudo curl -L "https://github.com/docker/compose/releases/download/1.28.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
## install albert
curl https://build.opensuse.org/projects/home:manuelschneid3r/public_key | sudo apt-key add -
echo 'deb http://download.opensuse.org/repositories/home:/manuelschneid3r/xUbuntu_20.04/ /' | sudo tee /etc/apt/sources.list.d/home:manuelschneid3r.list
wget -nv https://download.opensuse.org/repositories/home:manuelschneid3r/xUbuntu_20.04/Release.key -O "/etc/apt/trusted.gpg.d/home:manuelschneid3r.asc"
apt update
apt install albert -y
## Plank
apt install plank -y
## ZSH + OhMyZSH
apt install zsh -y
# zsh as default shell
sh -c "echo $(which zsh) >> /etc/shells" && chsh -s $(which zsh)
sh -c "$(wget -O- https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
### plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:=~/.oh-my-zsh/custom}/plugins/zsh-completions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
apt install autojump -y

## Hyper
wget -O /tmp/hyper_3.0.2_amd64.deb https://releases.hyper.is/download/deb
dpkg -i /tmp/hyper_3.0.2_amd64.deb

